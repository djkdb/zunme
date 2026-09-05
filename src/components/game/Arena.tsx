"use client";

import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody, type RapierCollider } from "@react-three/rapier";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ARENA_HEIGHT, ARENA_RADIUS, COLLAPSIBLE_MIN_RADIUS, TILE_SIZE } from "@/game/config";
import { TILES, buildTileSchedule, getTileState, type TileState } from "@/game/arena";
import { elapsedSinceStart } from "@/game/clock";
import { useGameStore } from "@/store/gameStore";
import { burst } from "@/game/effects";

const TILE_THICKNESS = 0.7;
const TILE_HALF = TILE_SIZE * 0.5 * 0.98;
const COLOR_A = new THREE.Color("#f4f1ea");
const COLOR_B = new THREE.Color("#e6e1d6");
const COLOR_EDGE_A = new THREE.Color("#ffd4a8");
const COLOR_EDGE_B = new THREE.Color("#ffc994");
const COLOR_WARN = new THREE.Color("#ff5a3c");
const COLOR_GONE = new THREE.Color("#6b4f3a");

const tmpMatrix = new THREE.Matrix4();
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpEuler = new THREE.Euler();
const tmpColor = new THREE.Color();

function baseColor(index: number, collapsible: boolean): THREE.Color {
  const tile = TILES[index];
  const i = Math.round(tile.x / TILE_SIZE);
  const j = Math.round(tile.z / TILE_SIZE);
  const checker = (i + j) % 2 === 0;
  if (collapsible) return checker ? COLOR_EDGE_A : COLOR_EDGE_B;
  return checker ? COLOR_A : COLOR_B;
}

/**
 * The floating island: an instanced grid of tiles clipped to a circle.
 * Outer tiles cycle NORMAL → WARNING → COLLAPSED on a seeded schedule;
 * physics colliders are toggled to match so players really fall through.
 */
export function Arena() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const seed = useGameStore((s) => s.state.seed);
  const schedule = useMemo(() => buildTileSchedule(seed), [seed]);
  const colliders = useRef<(RapierCollider | null)[]>(TILES.map(() => null));
  const phases = useRef<TileState[]>(TILES.map(() => ({ phase: "NORMAL", progress: 0, permanent: false })));
  const scratch = useRef<TileState>({ phase: "NORMAL", progress: 0, permanent: false });
  const yOffsets = useRef<Float32Array>(new Float32Array(TILES.length));

  const bindCollider = useCallback((index: number) => (c: RapierCollider | null) => {
    colliders.current[index] = c;
    // Keep a freshly (re)mounted collider in sync with the tile's current phase.
    if (c) c.setEnabled(phases.current[index].phase !== "COLLAPSED");
  }, []);

  // Initial instance colors + matrices.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    TILES.forEach((tile, i) => {
      tmpMatrix.makeTranslation(tile.x, -TILE_THICKNESS / 2, tile.z);
      mesh.setMatrixAt(i, tmpMatrix);
      mesh.setColorAt(i, baseColor(i, tile.collapsible));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const state = useGameStore.getState().state;
    const active = state.status === "PLAYING" || state.status === "COUNTDOWN";
    const elapsed = active ? elapsedSinceStart(state) : -Infinity;
    const now = performance.now();
    let matrixDirty = false;
    let colorDirty = false;

    for (let i = 0; i < TILES.length; i++) {
      const tile = TILES[i];
      const prev = phases.current[i];
      const next = tile.collapsible && Number.isFinite(elapsed) ? getTileState(schedule[i], elapsed, scratch.current) : { phase: "NORMAL" as const, progress: 0, permanent: false };

      const phaseChanged = prev.phase !== next.phase || prev.permanent !== next.permanent;
      if (phaseChanged) {
        const collider = colliders.current[i];
        if (collider) collider.setEnabled(next.phase !== "COLLAPSED");
        if (next.phase === "COLLAPSED") {
          burst({ position: { x: tile.x, y: 0, z: tile.z }, color: ["#ffc994", "#a06a45", "#ffffff"], count: 14, speed: 3, life: 0.8, size: 0.16, gravity: 12 });
        }
        prev.phase = next.phase;
        prev.permanent = next.permanent;
      }
      prev.progress = next.progress;

      // Visual state
      let y = -TILE_THICKNESS / 2;
      let s = 1;
      let rx = 0;
      let rz = 0;
      if (next.phase === "WARNING") {
        const shake = Math.sin(now * 0.05 + i) * 0.03 * next.progress;
        rx = shake;
        rz = -shake;
        y += Math.sin(now * 0.03) * 0.02 * next.progress;
      } else if (next.phase === "COLLAPSED") {
        if (next.permanent) {
          const p = next.progress; // 0..1 over first second, then gone
          y -= p * p * 14;
          s = Math.max(0, 1 - p);
          rx = p * 1.2;
        } else {
          // Drop away then rise back for the final 25%
          const p = next.progress;
          const drop = p < 0.75 ? Math.min(1, p / 0.2) : 1 - (p - 0.75) / 0.25;
          const eased = drop * drop;
          y -= eased * 6;
          s = 1 - eased * 0.9;
          rz = eased * 0.6 * ((i % 2) * 2 - 1);
        }
      }
      if (yOffsets.current[i] !== y || next.phase !== "NORMAL" || phaseChanged) {
        tmpPos.set(tile.x, y, tile.z);
        tmpQuat.setFromEuler(tmpEuler.set(rx, 0, rz));
        tmpScale.set(s, s, s);
        tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
        mesh.setMatrixAt(i, tmpMatrix);
        yOffsets.current[i] = y;
        matrixDirty = true;
      }

      if (next.phase === "WARNING") {
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.02);
        tmpColor.copy(baseColor(i, true)).lerp(COLOR_WARN, 0.35 + 0.55 * pulse * Math.min(1, next.progress + 0.3));
        mesh.setColorAt(i, tmpColor);
        colorDirty = true;
      } else if (next.phase === "COLLAPSED") {
        mesh.setColorAt(i, COLOR_GONE);
        colorDirty = true;
      } else if (phaseChanged) {
        mesh.setColorAt(i, baseColor(i, tile.collapsible));
        colorDirty = true;
      }
    }
    if (matrixDirty) mesh.instanceMatrix.needsUpdate = true;
    if (colorDirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      {/* One static body, one box collider per tile; collapsible ones get toggled from the frame loop. */}
      <RigidBody type="fixed" colliders={false} userData={{ type: "ground" }}>
        {TILES.map((tile) => (
          <CuboidCollider
            key={tile.index}
            ref={bindCollider(tile.index)}
            args={[TILE_HALF, TILE_THICKNESS / 2, TILE_HALF]}
            position={[tile.x, -TILE_THICKNESS / 2, tile.z]}
            friction={0.9}
          />
        ))}
      </RigidBody>
      <instancedMesh ref={meshRef} args={[undefined, undefined, TILES.length]} castShadow receiveShadow frustumCulled={false}>
        <boxGeometry args={[TILE_SIZE * 0.975, TILE_THICKNESS, TILE_SIZE * 0.975]} />
        <meshStandardMaterial roughness={0.85} metalness={0} />
      </instancedMesh>

      {/* Island rock beneath the core (decorative — outer tiles overhang so falls are real). */}
      <mesh position={[0, -ARENA_HEIGHT / 2 - TILE_THICKNESS, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[COLLAPSIBLE_MIN_RADIUS - 0.4, 2.2, ARENA_HEIGHT, 10, 1]} />
        <meshStandardMaterial color="#8a6a52" roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0, -ARENA_HEIGHT - TILE_THICKNESS - 0.6, 0]}>
        <coneGeometry args={[2.2, 2.2, 8]} />
        <meshStandardMaterial color="#6f533f" roughness={1} flatShading />
      </mesh>
      {/* dark bedrock right under the core tiles so the seams between tiles read as grout, not sky */}
      <mesh position={[0, -TILE_THICKNESS - 0.08, 0]}>
        <cylinderGeometry args={[COLLAPSIBLE_MIN_RADIUS - 0.6, COLLAPSIBLE_MIN_RADIUS - 0.6, 0.16, 24, 1]} />
        <meshStandardMaterial color="#4a3a30" roughness={1} />
      </mesh>
      {/* grass skirt around the rock, below the overhang */}
      <mesh position={[0, -TILE_THICKNESS - 0.55, 0]} receiveShadow>
        <cylinderGeometry args={[COLLAPSIBLE_MIN_RADIUS - 0.3, COLLAPSIBLE_MIN_RADIUS - 0.6, 0.5, 24, 1]} />
        <meshStandardMaterial color="#6fcf7a" roughness={0.9} flatShading />
      </mesh>

      {/* Glowing danger ring at the rim, purely visual */}
      <mesh position={[0, -TILE_THICKNESS - 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ARENA_RADIUS - 0.2, ARENA_RADIUS + 0.35, 64]} />
        <meshBasicMaterial color="#ff8c5a" transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>

      {/* Support pillars for the overhang, decorative */}
      {[0, 1, 2, 3, 4, 5].map((k) => {
        const a = (k / 6) * Math.PI * 2 + 0.3;
        const r = COLLAPSIBLE_MIN_RADIUS + 2.4;
        return (
          <mesh key={k} position={[Math.cos(a) * r, -TILE_THICKNESS - 1.3, Math.sin(a) * r]} rotation={[0, -a, 0]}>
            <boxGeometry args={[0.5, 1.9, 0.5]} />
            <meshStandardMaterial color="#c9b79c" roughness={0.9} flatShading />
          </mesh>
        );
      })}
    </group>
  );
}
