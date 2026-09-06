"use client";

import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody, type RapierCollider } from "@react-three/rapier";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { roundedTile } from "@/components/game/tileGeometry";
import { TIPTOE_COLS, TIPTOE_TILE } from "@/game/config";
import { burst, shake } from "@/game/effects";
import { TIPTOE_GOAL_Z, TIPTOE_START_Z, buildTiptoe, type TiptoeTile } from "@/game/modes";
import { sound } from "@/game/audio";
import { reportProgress } from "@/game/party";
import { onGameplayEvent } from "@/game/sync";
import { THEMES } from "@/game/theme";
import { useGameStore } from "@/store/gameStore";

const THICK = 0.5;
const HALF = TIPTOE_TILE * 0.5 * 0.94;
const HIDDEN_COLOR = new THREE.Color("#6d7bb0");
const SAFE_COLOR = new THREE.Color("#2ed573");
const FAKE_COLOR = new THREE.Color("#ff4757");
const HIDDEN_M = new THREE.Matrix4().makeScale(0, 0, 0);
const tmpMatrix = new THREE.Matrix4();
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpEuler = new THREE.Euler();

// module registry: collider handle → tile index, and the tiles (for the step hook)
const handleToTile = new Map<number, number>();
let tilesRef: TiptoeTile[] = [];
const revealed: Uint8Array = new Uint8Array(64); // 0 hidden, 1 safe, 2 fake (fallen)
const pendingSteps: number[] = [];
let pendingRow = -1;

/** Called by the local player controller with the collider it stands on. */
export function tiptoeStep(colliderHandle: number): boolean {
  const idx = handleToTile.get(colliderHandle);
  if (idx === undefined) return true;
  if (revealed[idx] === 0) pendingSteps.push(idx);
  // Standing on a safe tile counts as progress even when someone else revealed it.
  const t = tilesRef[idx];
  if (t?.safe && revealed[idx] !== 2 && t.row > pendingRow) pendingRow = t.row;
  // A fake tile gives no footing: the caller cancels the jump so bunny-hopping can't skip the trap.
  return t ? t.safe : true;
}

export function TiptoeCourse() {
  const seed = useGameStore((s) => s.state.seed);
  const tiles = useMemo(() => buildTiptoe(seed), [seed]);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const colliders = useRef<(RapierCollider | null)[]>(tiles.map(() => null));
  const fellAt = useRef<Float64Array>(new Float64Array(tiles.length));
  const lastRound = useRef(-1);

  useEffect(() => {
    tilesRef = tiles;
    if (process.env.NODE_ENV === "production") return;
    const w = window as unknown as { __dropzone?: Record<string, unknown> };
    w.__dropzone = { ...(w.__dropzone ?? {}), tiptoe: tiles, tiptoeRevealed: revealed };
  }, [tiles]);

  const paint = useCallback(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    tiles.forEach((t, i) => {
      if (revealed[i] === 2) mesh.setMatrixAt(i, HIDDEN_M);
      else {
        tmpMatrix.makeTranslation(t.x, -THICK / 2, t.z);
        mesh.setMatrixAt(i, tmpMatrix);
      }
      mesh.setColorAt(i, revealed[i] === 1 ? SAFE_COLOR : HIDDEN_COLOR);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [tiles]);

  const resetAll = useCallback(() => {
    revealed.fill(0);
    fellAt.current.fill(0);
    pendingSteps.length = 0;
    pendingRow = -1;
    colliders.current.forEach((c) => c?.setEnabled(true));
    paint();
  }, [paint]);

  const reveal = useCallback(
    (index: number, remote: boolean) => {
      const t = tiles[index];
      if (!t || revealed[index] !== 0) return;
      const mesh = meshRef.current;
      if (t.safe) {
        revealed[index] = 1;
        if (mesh) {
          mesh.setColorAt(index, SAFE_COLOR);
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
        if (!remote) sound.play("click", { volume: 0.4 });
      } else {
        revealed[index] = 2;
        fellAt.current[index] = performance.now();
        colliders.current[index]?.setEnabled(false);
        burst({ position: { x: t.x, y: 0, z: t.z }, color: ["#ff4757", "#ffffff"], count: 12, speed: 3, life: 0.6, size: 0.14, gravity: 10 });
        if (!remote) {
          sound.play("elimination", { volume: 0.5 });
          shake(0.3);
        }
      }
    },
    [tiles],
  );

  const bindCollider = useCallback((index: number) => (c: RapierCollider | null) => {
    const prev = colliders.current[index];
    if (prev) handleToTile.delete(prev.handle);
    colliders.current[index] = c;
    if (c) {
      handleToTile.set(c.handle, index);
      c.setEnabled(revealed[index] !== 2);
    }
  }, []);

  useEffect(() => {
    resetAll();
    const off = onGameplayEvent((evt) => {
      if (evt.k === "reveal") reveal(evt.index, true);
    });
    const unsub = useGameStore.subscribe((s) => {
      if (s.state.status === "COUNTDOWN" && s.state.round !== lastRound.current) {
        lastRound.current = s.state.round;
        resetAll();
      }
      if (s.state.status === "LOBBY" && lastRound.current !== -1) {
        lastRound.current = -1;
        resetAll();
      }
    });
    return () => {
      off();
      unsub();
      handleToTile.clear();
      pendingSteps.length = 0;
    };
  }, [resetAll, reveal, seed]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const store = useGameStore.getState();
    while (pendingSteps.length) {
      const idx = pendingSteps.pop()!;
      if (revealed[idx] !== 0) continue;
      reveal(idx, false);
      store.client?.broadcastGameplay({ k: "reveal", index: idx });
    }
    if (pendingRow >= 0) {
      reportProgress(pendingRow);
      pendingRow = -1;
    }
    const now = performance.now();
    let dirty = false;
    for (let i = 0; i < tiles.length; i++) {
      if (revealed[i] !== 2 || fellAt.current[i] === 0) continue;
      const k = Math.min(1, (now - fellAt.current[i]) / 500);
      const t = tiles[i];
      tmpPos.set(t.x, -THICK / 2 - k * k * 7, t.z);
      tmpQuat.setFromEuler(tmpEuler.set(k * 1.4, 0, k * 0.7 * ((i % 2) * 2 - 1)));
      tmpScale.setScalar(Math.max(0.001, 1 - k));
      mesh.setMatrixAt(i, tmpMatrix.compose(tmpPos, tmpQuat, tmpScale));
      mesh.setColorAt(i, FAKE_COLOR);
      dirty = true;
      if (k >= 1) fellAt.current[i] = 0;
    }
    if (dirty) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  const halfW = (TIPTOE_COLS * TIPTOE_TILE) / 2 + 0.6;
  const goalZ = TIPTOE_GOAL_Z;
  return (
    <group>
      {/* start platform */}
      <RigidBody type="fixed" colliders={false} userData={{ type: "ground" }}>
        <CuboidCollider args={[halfW, 0.5, 3.2]} position={[0, -0.5, TIPTOE_START_Z]} friction={0.9} />
        <CuboidCollider args={[halfW, 0.5, 2.6]} position={[0, -0.5, goalZ]} friction={0.9} />
        {/* back wall so nobody sprints off the far edge of the goal */}
        <CuboidCollider args={[halfW, 1.5, 0.3]} position={[0, 1.5, goalZ - 2.6]} />
      </RigidBody>
      <mesh position={[0, 1.2, goalZ - 2.6]} castShadow>
        <boxGeometry args={[halfW * 2, 2.4, 0.5]} />
        <meshStandardMaterial color="#ffd9a0" roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.5, TIPTOE_START_Z]} receiveShadow castShadow>
        <boxGeometry args={[halfW * 2, 1, 6.4]} />
        <meshStandardMaterial color="#f4f1ea" roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.5, goalZ]} receiveShadow castShadow>
        <boxGeometry args={[halfW * 2, 1, 5.2]} />
        <meshStandardMaterial color="#ffe8a0" roughness={0.8} />
      </mesh>
      {/* goal gate */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (halfW - 0.4), 1.6, goalZ]} castShadow>
          <boxGeometry args={[0.4, 3.2, 0.4]} />
          <meshStandardMaterial color="#ffd32a" emissive="#ffb000" emissiveIntensity={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 3.3, goalZ]}>
        <boxGeometry args={[halfW * 2 - 0.4, 0.5, 0.5]} />
        <meshStandardMaterial color="#ffd32a" emissive="#ffb000" emissiveIntensity={0.3} />
      </mesh>
      {/* the grid */}
      <RigidBody type="fixed" colliders={false} userData={{ type: "ground" }}>
        {tiles.map((t) => (
          <CuboidCollider key={t.index} ref={bindCollider(t.index)} args={[HALF, THICK / 2, HALF]} position={[t.x, -THICK / 2, t.z]} friction={0.9} />
        ))}
      </RigidBody>
      <instancedMesh ref={(m) => { meshRef.current = m; if (m) paint(); }} args={[undefined, undefined, tiles.length]} castShadow receiveShadow frustumCulled={false}>
        <primitive object={roundedTile(TIPTOE_TILE * 0.9, THICK, TIPTOE_TILE * 0.9)} attach="geometry" />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      {/* side rails so the course reads as a bridge over nothing */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (halfW + 0.3), -0.9, (TIPTOE_START_Z + goalZ) / 2]}>
          <boxGeometry args={[0.2, 0.2, TIPTOE_START_Z - goalZ + 6]} />
          <meshBasicMaterial color={THEMES.TIPTOE.rim} transparent opacity={0.5} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, -14, (TIPTOE_START_Z + goalZ) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, 80]} />
        <meshBasicMaterial color={THEMES.TIPTOE.seaDeep} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}
