"use client";

import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody, type RapierCollider } from "@react-three/rapier";
import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { MELTDOWN_STEP_DELAY, TILE_SIZE } from "@/game/config";
import { burst } from "@/game/effects";
import { MELTDOWN_LAYER_COLORS, MELTDOWN_LAYER_Y, MELTDOWN_TILES, tileInLayer } from "@/game/meltdown";
import { onGameplayEvent } from "@/game/sync";
import { useGameStore } from "@/store/gameStore";

const THICKNESS = 0.6;
const HALF = TILE_SIZE * 0.5 * 0.97;
const LAYERS = MELTDOWN_LAYER_Y.length;
const N = MELTDOWN_TILES.length;
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

// ── module registry: collider handle → tile, and steps waiting to be processed ──
const handleToTile = new Map<number, { layer: number; index: number }>();
const pendingSteps: { layer: number; index: number }[] = [];

/** Called by the local player controller with the collider it is standing on. */
export function meltdownStep(colliderHandle: number) {
  const tile = handleToTile.get(colliderHandle);
  if (tile) pendingSteps.push(tile);
}

const tmpMatrix = new THREE.Matrix4();
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpEuler = new THREE.Euler();
const tmpColor = new THREE.Color();
const WARN = new THREE.Color("#ff5a3c");

type Phase = 0 | 1 | 2; // intact, stepped (about to vanish), gone

/** MELTDOWN — two floors of tiles that vanish once stepped on. */
export function MeltdownArena() {
  const meshes = useRef<(THREE.InstancedMesh | null)[]>(MELTDOWN_LAYER_Y.map(() => null));
  const colliders = useRef<(RapierCollider | null)[][]>(MELTDOWN_LAYER_Y.map(() => Array(N).fill(null)));
  const phase = useRef<Phase[][]>(MELTDOWN_LAYER_Y.map(() => Array(N).fill(0)));
  const at = useRef<number[][]>(MELTDOWN_LAYER_Y.map(() => Array(N).fill(0)));
  const lastRound = useRef(-1);

  const resetAll = useCallback(() => {
    for (let l = 0; l < LAYERS; l++) {
      const mesh = meshes.current[l];
      for (let i = 0; i < N; i++) {
        phase.current[l][i] = 0;
        at.current[l][i] = 0;
        colliders.current[l][i]?.setEnabled(true);
        if (mesh) {
          const t = MELTDOWN_TILES[i];
          if (tileInLayer(t, l)) {
            tmpMatrix.makeTranslation(t.x, MELTDOWN_LAYER_Y[l] - THICKNESS / 2, t.z);
            mesh.setMatrixAt(i, tmpMatrix);
          } else {
            mesh.setMatrixAt(i, HIDDEN);
          }
          mesh.setColorAt(i, baseColor(l, i));
        }
      }
      if (mesh) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
    pendingSteps.length = 0;
  }, []);

  const vanish = useCallback((layer: number, index: number) => {
    if (phase.current[layer][index] === 2) return;
    phase.current[layer][index] = 2;
    at.current[layer][index] = performance.now();
    colliders.current[layer][index]?.setEnabled(false);
    const t = MELTDOWN_TILES[index];
    burst({ position: { x: t.x, y: MELTDOWN_LAYER_Y[layer], z: t.z }, color: [MELTDOWN_LAYER_COLORS[layer][0], "#ffffff"], count: 10, speed: 2.5, life: 0.6, size: 0.14, gravity: 10 });
  }, []);

  const bindCollider = useCallback(
    (layer: number, index: number) => (c: RapierCollider | null) => {
      const prev = colliders.current[layer][index];
      if (prev) handleToTile.delete(prev.handle);
      colliders.current[layer][index] = c;
      if (c) {
        handleToTile.set(c.handle, { layer, index });
        c.setEnabled(phase.current[layer][index] !== 2);
      }
    },
    [],
  );

  const bindMesh = useCallback((layer: number) => (m: THREE.InstancedMesh | null) => {
    meshes.current[layer] = m;
    if (!m) return;
    for (let i = 0; i < N; i++) {
      const t = MELTDOWN_TILES[i];
      if (tileInLayer(t, layer)) {
        tmpMatrix.makeTranslation(t.x, MELTDOWN_LAYER_Y[layer] - THICKNESS / 2, t.z);
        m.setMatrixAt(i, tmpMatrix);
      } else {
        m.setMatrixAt(i, HIDDEN);
      }
      m.setColorAt(i, baseColor(layer, i));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);

  // Remote tile events + reset on a new round.
  useEffect(() => {
    const off = onGameplayEvent((evt) => {
      if (evt.k === "tile") vanish(evt.layer, evt.index);
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
  }, [vanish, resetAll]);

  useFrame(() => {
    const now = performance.now();
    const store = useGameStore.getState();
    const active = store.state.status === "PLAYING";

    // Steps reported by the local player this frame.
    while (pendingSteps.length) {
      const { layer, index } = pendingSteps.pop()!;
      if (active && phase.current[layer][index] === 0) {
        phase.current[layer][index] = 1;
        at.current[layer][index] = now;
      }
    }

    for (let l = 0; l < LAYERS; l++) {
      const mesh = meshes.current[l];
      if (!mesh) continue;
      let matrixDirty = false;
      let colorDirty = false;
      for (let i = 0; i < N; i++) {
        const p = phase.current[l][i];
        if (p === 0) continue;
        const t = MELTDOWN_TILES[i];
        const elapsed = now - at.current[l][i];
        if (p === 1) {
          if (elapsed >= MELTDOWN_STEP_DELAY) {
            vanish(l, i);
            store.client?.broadcastGameplay({ k: "tile", layer: l, index: i });
          } else {
            const k = elapsed / MELTDOWN_STEP_DELAY;
            tmpPos.set(t.x, MELTDOWN_LAYER_Y[l] - THICKNESS / 2 - k * 0.15, t.z);
            tmpQuat.setFromEuler(tmpEuler.set(Math.sin(now * 0.05) * 0.06 * k, 0, Math.cos(now * 0.05) * 0.06 * k));
            tmpScale.setScalar(1);
            mesh.setMatrixAt(i, tmpMatrix.compose(tmpPos, tmpQuat, tmpScale));
            mesh.setColorAt(i, tmpColor.copy(baseColor(l, i)).lerp(WARN, k));
            matrixDirty = colorDirty = true;
          }
        }
        if (phase.current[l][i] === 2) {
          const k = Math.min(1, (now - at.current[l][i]) / 450);
          const s = Math.max(0, 1 - k);
          tmpPos.set(t.x, MELTDOWN_LAYER_Y[l] - THICKNESS / 2 - k * k * 6, t.z);
          tmpQuat.setFromEuler(tmpEuler.set(k * 1.5, 0, k * 0.8));
          tmpScale.setScalar(s);
          mesh.setMatrixAt(i, tmpMatrix.compose(tmpPos, tmpQuat, tmpScale));
          matrixDirty = true;
        }
      }
      if (matrixDirty) mesh.instanceMatrix.needsUpdate = true;
      if (colorDirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      {MELTDOWN_LAYER_Y.map((y, layer) => (
        <group key={layer}>
          <RigidBody type="fixed" colliders={false} userData={{ type: "ground" }}>
            {MELTDOWN_TILES.filter((t) => tileInLayer(t, layer)).map((t) => (
              <CuboidCollider key={t.index} ref={bindCollider(layer, t.index)} args={[HALF, THICKNESS / 2, HALF]} position={[t.x, y - THICKNESS / 2, t.z]} friction={0.9} />
            ))}
          </RigidBody>
          <instancedMesh ref={bindMesh(layer)} args={[undefined, undefined, N]} castShadow receiveShadow frustumCulled={false}>
            <boxGeometry args={[TILE_SIZE * 0.94, THICKNESS, TILE_SIZE * 0.94]} />
            <meshStandardMaterial roughness={0.7} />
          </instancedMesh>
        </group>
      ))}
      {/* central column the floors hang around, purely decorative */}
      <mesh position={[0, -12, 0]}>
        <cylinderGeometry args={[1.2, 2, 22, 8]} />
        <meshStandardMaterial color="#3a3f5c" roughness={0.8} flatShading />
      </mesh>
      {/* lava glow far below */}
      <mesh position={[0, -25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[16, 32]} />
        <meshBasicMaterial color="#ff7a3c" transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

function baseColor(layer: number, index: number): THREE.Color {
  const t = MELTDOWN_TILES[index];
  const i = Math.round(t.x / TILE_SIZE);
  const j = Math.round(t.z / TILE_SIZE);
  return new THREE.Color(MELTDOWN_LAYER_COLORS[layer][(i + j) % 2 === 0 ? 0 : 1]);
}
