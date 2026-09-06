"use client";

import { useFrame } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody, useBeforePhysicsStep, type RapierCollider, type RapierRigidBody } from "@react-three/rapier";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Arena } from "@/components/game/Arena";
import { Meteors } from "@/components/game/Meteors";
import { Obstacles, Spinner, currentElapsed } from "@/components/game/Obstacles";
import { roundedTile } from "@/components/game/tileGeometry";
import { COLOR_FALL_Y, HILL_HEIGHT, HILL_RADIUS, SPIN_RADIUS, TILE_SIZE, WALLS_HALF_X, WALLS_HALF_Z } from "@/game/config";
import { burst, shake } from "@/game/effects";
import {
  COLOR_PALETTE,
  COLOR_TILES,
  SPIN_BARS,
  WALL_SLOT_WIDTH,
  buildCoinWaves,
  buildWallSchedule,
  colorPattern,
  colorPhaseAt,
  spinAngleAt,
  wallZAt,
  type ColorPhase,
} from "@/game/modes";
import { colorRuntime, partyRuntime } from "@/game/party";
import { livePoses } from "@/game/remote";
import { sound } from "@/game/audio";
import { THEMES } from "@/game/theme";
import { useGameStore } from "@/store/gameStore";

const tmpMatrix = new THREE.Matrix4();
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpEuler = new THREE.Euler();
const tmpColor = new THREE.Color();
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const WALL_DATA = { type: "wall" } as const;
const GROUND_DATA = { type: "ground" } as const;

// ── COLOR PANIC ──────────────────────────────────────────────────────
const COLOR_THICK = 0.6;
const COLOR_HALF = TILE_SIZE * 0.5 * 0.97;
const DIM = new THREE.Color("#3a3a4a");

export function ColorArena() {
  const seed = useGameStore((s) => s.state.seed);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const colliders = useRef<(RapierCollider | null)[]>(COLOR_TILES.map(() => null));
  const pattern = useRef<Uint8Array>(colorPattern(seed, 0));
  const cycle = useRef(-1);
  const phaseRef = useRef<ColorPhase>({ cycle: 0, phase: "roam", progress: 0, called: 0, msLeft: 0 });
  const lastPhase = useRef<ColorPhase["phase"]>("roam");
  const dropped = useRef<boolean[]>(COLOR_TILES.map(() => false));
  const bases = useMemo(() => COLOR_PALETTE.map((c) => new THREE.Color(c.hex)), []);
  const darks = useMemo(() => COLOR_PALETTE.map((c) => new THREE.Color(c.dark)), []);

  const bindCollider = useCallback((index: number) => (c: RapierCollider | null) => {
    colliders.current[index] = c;
    if (c) c.setEnabled(!dropped.current[index]);
  }, []);

  const paintAll = useCallback((pat: Uint8Array) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    COLOR_TILES.forEach((t, i) => {
      tmpMatrix.makeTranslation(t.x, -COLOR_THICK / 2, t.z);
      mesh.setMatrixAt(i, tmpMatrix);
      mesh.setColorAt(i, bases[pat[i]]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [bases]);

  useEffect(() => {
    pattern.current = colorPattern(seed, 0);
    cycle.current = -1;
  }, [seed]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const elapsed = currentElapsed();
    const active = Number.isFinite(elapsed) && elapsed > 0;
    const ph = active ? colorPhaseAt(seed, elapsed, phaseRef.current) : Object.assign(phaseRef.current, { cycle: 0, phase: "roam" as const, progress: 0, called: 0, msLeft: 0 });
    colorRuntime.phase = active ? ph.phase : "roam";
    colorRuntime.called = ph.called;
    colorRuntime.msLeft = ph.msLeft;
    colorRuntime.cycle = ph.cycle;
    if (ph.cycle !== cycle.current) {
      cycle.current = ph.cycle;
      pattern.current = colorPattern(seed, ph.cycle);
      for (let i = 0; i < COLOR_TILES.length; i++) {
        dropped.current[i] = false;
        colliders.current[i]?.setEnabled(true);
      }
      paintAll(pattern.current);
      lastPhase.current = "roam";
    }
    if (ph.phase !== lastPhase.current) {
      lastPhase.current = ph.phase;
      if (ph.phase === "warn") sound.play("warning", { volume: 0.6 });
      if (ph.phase === "drop") {
        sound.play("impact", { volume: 0.8 });
        shake(0.3);
      }
    }
    if (!active || ph.phase === "roam") return;
    const now = performance.now();
    const pat = pattern.current;
    let dirty = false;
    for (let i = 0; i < COLOR_TILES.length; i++) {
      const c = pat[i];
      const t = COLOR_TILES[i];
      if (c === ph.called) continue;
      if (ph.phase === "warn") {
        const pulse = 0.5 + 0.5 * Math.sin(now * (0.012 + ph.progress * 0.03));
        mesh.setColorAt(i, tmpColor.copy(darks[c]).lerp(DIM, 0.3 + 0.5 * pulse * ph.progress));
        dirty = true;
      } else {
        if (!dropped.current[i]) {
          dropped.current[i] = true;
          colliders.current[i]?.setEnabled(false);
        }
        const k = Math.min(1, ph.progress * 2.2);
        tmpPos.set(t.x, -COLOR_THICK / 2 - k * k * 9, t.z);
        tmpQuat.setFromEuler(tmpEuler.set(k * 0.9 * ((i % 3) - 1), 0, k * 0.6));
        tmpScale.setScalar(Math.max(0.001, 1 - k));
        mesh.setMatrixAt(i, tmpMatrix.compose(tmpPos, tmpQuat, tmpScale));
        mesh.setColorAt(i, DIM);
        dirty = true;
      }
    }
    if (dirty) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      <RigidBody type="fixed" colliders={false} userData={GROUND_DATA}>
        {COLOR_TILES.map((t) => (
          <CuboidCollider key={t.index} ref={bindCollider(t.index)} args={[COLOR_HALF, COLOR_THICK / 2, COLOR_HALF]} position={[t.x, -COLOR_THICK / 2, t.z]} friction={0.9} />
        ))}
      </RigidBody>
      <instancedMesh ref={(m) => { meshRef.current = m; if (m) paintAll(pattern.current); }} args={[undefined, undefined, COLOR_TILES.length]} castShadow receiveShadow frustumCulled={false}>
        <primitive object={roundedTile(TILE_SIZE * 0.94, COLOR_THICK, TILE_SIZE * 0.94)} attach="geometry" />
        <meshStandardMaterial roughness={0.55} />
      </instancedMesh>
      <mesh position={[0, -6, 0]}>
        <cylinderGeometry args={[3, 5, 10, 8]} />
        <meshStandardMaterial color="#2b2d42" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, COLOR_FALL_Y - 4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[30, 32]} />
        <meshBasicMaterial color={THEMES.COLOR.seaDeep} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

// ── WALL RUSH ────────────────────────────────────────────────────────
const WALL_POOL = 4;
const WALL_HEIGHT = 2.6;
const WALL_SLOT_COUNT = Math.round((WALLS_HALF_X * 2) / WALL_SLOT_WIDTH);
const WALL_COLORS = ["#3d8bff", "#ff6bcb", "#2ed573", "#ffd32a"];

function WallBody({ slot, schedule }: { slot: number; schedule: ReturnType<typeof buildWallSchedule> }) {
  const body = useRef<RapierRigidBody>(null);
  const segs = useRef<(RapierCollider | null)[]>(Array(WALL_SLOT_COUNT).fill(null));
  const meshes = useRef<(THREE.Mesh | null)[]>(Array(WALL_SLOT_COUNT).fill(null));
  const current = useRef(-1);
  const pos = useRef(new THREE.Vector3(0, 0, 1000));

  useBeforePhysicsStep(() => {
    const rb = body.current;
    if (!rb) return;
    const elapsed = currentElapsed();
    let active: (typeof schedule)[number] | null = null;
    let z = 0;
    if (Number.isFinite(elapsed)) {
      for (let i = slot; i < schedule.length; i += WALL_POOL) {
        const w = schedule[i];
        if (w.startAt > elapsed) break;
        const wz = wallZAt(w, elapsed);
        if (wz !== null) {
          active = w;
          z = wz;
        }
      }
    }
    if (active && active.index !== current.current) {
      current.current = active.index;
      for (let s = 0; s < WALL_SLOT_COUNT; s++) {
        segs.current[s]?.setEnabled(active.solid[s]);
        const m = meshes.current[s];
        if (m) m.visible = active.solid[s];
      }
      sound.play("warning", { volume: 0.45, throttleMs: 300 });
    } else if (!active && current.current !== -1) {
      current.current = -1;
      for (let s = 0; s < WALL_SLOT_COUNT; s++) segs.current[s]?.setEnabled(false);
    }
    pos.current.set(0, 0, active ? z : 1000);
    rb.setNextKinematicTranslation(pos.current);
  });

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[0, 0, 1000]} userData={WALL_DATA}>
      {Array.from({ length: WALL_SLOT_COUNT }, (_, s) => {
        const x = -WALLS_HALF_X + (s + 0.5) * WALL_SLOT_WIDTH;
        return (
          <group key={s}>
            <CuboidCollider ref={(c) => { segs.current[s] = c; if (c) c.setEnabled(false); }} args={[WALL_SLOT_WIDTH / 2 - 0.02, WALL_HEIGHT / 2, 0.35]} position={[x, WALL_HEIGHT / 2, 0]} />
            <mesh ref={(m) => { meshes.current[s] = m; }} castShadow position={[x, WALL_HEIGHT / 2, 0]}>
              <boxGeometry args={[WALL_SLOT_WIDTH - 0.08, WALL_HEIGHT, 0.7]} />
              <meshStandardMaterial color={WALL_COLORS[slot % WALL_COLORS.length]} roughness={0.5} />
            </mesh>
          </group>
        );
      })}
    </RigidBody>
  );
}

export function WallRush() {
  const seed = useGameStore((s) => s.state.seed);
  const schedule = useMemo(() => buildWallSchedule(seed), [seed]);
  const stripes = useMemo(() => Array.from({ length: 7 }, (_, i) => -WALLS_HALF_Z + 2 + i * ((WALLS_HALF_Z * 2 - 4) / 6)), []);
  return (
    <group>
      <RigidBody type="fixed" colliders={false} userData={GROUND_DATA}>
        <CuboidCollider args={[WALLS_HALF_X, 0.5, WALLS_HALF_Z]} position={[0, -0.5, 0]} friction={0.9} />
      </RigidBody>
      <mesh position={[0, -0.5, 0]} receiveShadow castShadow>
        <boxGeometry args={[WALLS_HALF_X * 2, 1, WALLS_HALF_Z * 2]} />
        <meshStandardMaterial color="#f4f1ea" roughness={0.8} />
      </mesh>
      {stripes.map((z) => (
        <mesh key={z} position={[0, 0.01, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[WALLS_HALF_X * 2, 0.25]} />
          <meshBasicMaterial color="#c9c3ff" transparent opacity={0.6} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (WALLS_HALF_X + 0.15), 0.06, 0]}>
          <boxGeometry args={[0.3, 0.12, WALLS_HALF_Z * 2]} />
          <meshBasicMaterial color={THEMES.WALLS.rim} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, -6, 0]}>
        <cylinderGeometry args={[4, 6, 10, 8]} />
        <meshStandardMaterial color="#2b2d42" roughness={0.9} flatShading />
      </mesh>
      {Array.from({ length: WALL_POOL }, (_, i) => (
        <WallBody key={i} slot={i} schedule={schedule} />
      ))}
    </group>
  );
}

// ── SPIN CYCLE ───────────────────────────────────────────────────────
export function SpinCycle() {
  const rim = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!rim.current) return;
    const m = rim.current.material as THREE.MeshBasicMaterial;
    m.opacity = 0.45 + 0.25 * Math.sin(performance.now() * 0.004);
  });
  return (
    <group>
      <RigidBody type="fixed" colliders={false} userData={GROUND_DATA}>
        <CylinderCollider args={[0.4, SPIN_RADIUS]} position={[0, -0.4, 0]} friction={0.9} />
      </RigidBody>
      <mesh position={[0, -0.4, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[SPIN_RADIUS, SPIN_RADIUS - 0.3, 0.8, 48]} />
        <meshStandardMaterial color="#f4f1ea" roughness={0.75} />
      </mesh>
      {[2.5, 5].map((r) => (
        <mesh key={r} position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[r - 0.08, r + 0.08, 48]} />
          <meshBasicMaterial color="#c9c3ff" transparent opacity={0.7} />
        </mesh>
      ))}
      <mesh ref={rim} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[SPIN_RADIUS - 0.35, SPIN_RADIUS, 64]} />
        <meshBasicMaterial color={THEMES.SPIN.rim} transparent opacity={0.6} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh position={[0, -6, 0]}>
        <cylinderGeometry args={[2.4, 4, 11, 10]} />
        <meshStandardMaterial color="#3a3f5c" roughness={0.9} flatShading />
      </mesh>
      {SPIN_BARS.map((bar, i) => (
        <Spinner key={i} position={[bar.offset[0], 0, bar.offset[1]]} length={bar.length} height={bar.height} color={bar.color} showPole={i !== 1} angleAt={(e) => spinAngleAt(bar, e)} />
      ))}
    </group>
  );
}

// ── HILL KING ────────────────────────────────────────────────────────
export function HillArena() {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ring.current) return;
    const zone = useGameStore.getState().state.zone;
    const m = ring.current.material as THREE.MeshBasicMaterial;
    const busy = zone.length > 0;
    m.opacity = busy ? 0.7 + 0.3 * Math.sin(performance.now() * 0.012) : 0.35;
    m.color.set(zone.length > 1 ? "#ff4757" : busy ? "#ffd32a" : "#ffffff");
  });
  return (
    <group>
      <Arena />
      <Meteors />
      <RigidBody type="fixed" colliders={false} userData={GROUND_DATA}>
        <CylinderCollider args={[HILL_HEIGHT / 2, HILL_RADIUS]} position={[0, HILL_HEIGHT / 2, 0]} friction={0.9} />
      </RigidBody>
      <mesh position={[0, HILL_HEIGHT / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[HILL_RADIUS, HILL_RADIUS + 0.6, HILL_HEIGHT, 32]} />
        <meshStandardMaterial color="#ffd9a0" roughness={0.7} />
      </mesh>
      <mesh position={[0, HILL_HEIGHT + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[HILL_RADIUS - 0.1, 32]} />
        <meshStandardMaterial color="#ffb347" roughness={0.6} />
      </mesh>
      <mesh ref={ring} position={[0, HILL_HEIGHT + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[HILL_RADIUS - 0.5, HILL_RADIUS - 0.15, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.4} toneMapped={false} />
      </mesh>
      <mesh position={[0, HILL_HEIGHT + 2.6, 0]}>
        <coneGeometry args={[0.35, 0.9, 4]} />
        <meshStandardMaterial color="#ffd32a" emissive="#ffd32a" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

// ── COIN FRENZY ──────────────────────────────────────────────────────
export function CoinField() {
  const seed = useGameStore((s) => s.state.seed);
  const coins = useMemo(() => buildCoinWaves(seed), [seed]);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const takenRef = useRef<Set<string>>(new Set());
  const seen = useRef<Set<string>>(new Set());
  const taken = useGameStore((s) => s.state.taken);
  useEffect(() => {
    takenRef.current = new Set(taken);
  }, [taken]);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const w = window as unknown as { __dropzone?: Record<string, unknown> };
    w.__dropzone = { ...(w.__dropzone ?? {}), coins };
  }, [coins]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const elapsed = currentElapsed();
    const now = performance.now();
    coins.forEach((c, i) => {
      const visible = Number.isFinite(elapsed) && elapsed >= c.at && !takenRef.current.has(c.id) && !partyRuntime.collected.has(c.id);
      if (!visible) {
        mesh.setMatrixAt(i, HIDDEN);
        return;
      }
      if (!seen.current.has(c.id)) {
        seen.current.add(c.id);
        burst({ position: { x: c.x, y: 1.2, z: c.z }, color: c.gold ? ["#ffd32a", "#ffffff"] : ["#ffffff", "#dfe6f2"], count: 4, speed: 1.5, life: 0.4, size: 0.08 });
      }
      const drop = Math.min(1, (elapsed - c.at) / 500);
      const y = 0.9 + (1 - drop) * (1 - drop) * 8 + Math.sin(now * 0.004 + i) * 0.1;
      tmpPos.set(c.x, y, c.z);
      tmpQuat.setFromEuler(tmpEuler.set(Math.PI / 2, 0, now * 0.003 + i));
      tmpScale.setScalar(c.gold ? 1.35 : 1);
      mesh.setMatrixAt(i, tmpMatrix.compose(tmpPos, tmpQuat, tmpScale));
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    coins.forEach((c, i) => mesh.setColorAt(i, tmpColor.set(c.gold ? "#ffd32a" : "#e8ecf4")));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    seen.current.clear();
  }, [coins]);

  return (
    <group>
      <Arena />
      <instancedMesh ref={meshRef} args={[undefined, undefined, coins.length]} frustumCulled={false} castShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.14, 16]} />
        <meshStandardMaterial roughness={0.25} metalness={0.7} />
      </instancedMesh>
    </group>
  );
}

// ── CROWN RUSH ───────────────────────────────────────────────────────
export function CrownArena() {
  const crown = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const g = crown.current;
    if (!g) return;
    const state = useGameStore.getState().state;
    const now = performance.now();
    const holder = state.holderId ? livePoses.get(state.holderId) : null;
    if (holder) {
      g.position.set(holder.x, holder.y + 2.25 + Math.sin(now * 0.006) * 0.08, holder.z);
      g.scale.setScalar(0.7);
    } else {
      g.position.set(0, 1.1 + Math.sin(now * 0.004) * 0.2, 0);
      g.scale.setScalar(1);
    }
    g.rotation.y = now * 0.002;
    if (glow.current) {
      glow.current.visible = !holder;
      (glow.current.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.25 * Math.sin(now * 0.01);
    }
  });
  return (
    <group>
      <Arena />
      <Obstacles />
      <group ref={crown}>
        <mesh castShadow>
          <cylinderGeometry args={[0.55, 0.45, 0.45, 8, 1, true]} />
          <meshStandardMaterial color="#ffd32a" emissive="#ffb000" emissiveIntensity={0.35} metalness={0.6} roughness={0.3} side={THREE.DoubleSide} />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.5, 0.42, Math.sin(a) * 0.5]}>
              <coneGeometry args={[0.13, 0.35, 4]} />
              <meshStandardMaterial color="#ffd32a" emissive="#ffb000" emissiveIntensity={0.35} metalness={0.6} roughness={0.3} />
            </mesh>
          );
        })}
        <mesh position={[0, 0.1, 0.5]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color="#ff4757" emissive="#ff4757" emissiveIntensity={0.6} />
        </mesh>
      </group>
      <mesh ref={glow} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.0, 1.5, 32]} />
        <meshBasicMaterial color="#ffd32a" transparent opacity={0.4} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ── Overhead markers (infected halo, bomb) ───────────────────────────
const MARKER_POOL = 8;

export function ModeMarkers() {
  const groups = useRef<(THREE.Group | null)[]>(Array(MARKER_POOL).fill(null));
  const mode = useGameStore((s) => s.state.mode);
  useFrame(() => {
    const state = useGameStore.getState().state;
    const now = performance.now();
    const ids = mode === "TAG" ? state.tagged.filter((id) => state.alive.includes(id)) : mode === "BOMB" && state.holderId ? [state.holderId] : [];
    for (let i = 0; i < MARKER_POOL; i++) {
      const g = groups.current[i];
      if (!g) continue;
      const id = ids[i];
      const p = id ? livePoses.get(id) : null;
      if (!p) {
        g.visible = false;
        continue;
      }
      g.visible = true;
      g.position.set(p.x, p.y + 2.2 + Math.sin(now * 0.006 + i) * 0.08, p.z);
      if (mode === "BOMB") {
        const left = Math.max(0, state.fuseAt - (useGameStore.getState().client?.now() ?? now));
        const rate = left < 3000 ? 0.03 : left < 6000 ? 0.015 : 0.008;
        const pulse = 1 + 0.2 * Math.max(0, Math.sin(now * rate));
        g.scale.setScalar(pulse);
      } else {
        g.scale.setScalar(1);
        g.rotation.y = now * 0.003;
      }
    }
  });
  if (mode !== "TAG" && mode !== "BOMB") return null;
  return (
    <group>
      {Array.from({ length: MARKER_POOL }, (_, i) => (
        <group key={i} ref={(g) => { groups.current[i] = g; }} visible={false}>
          {mode === "BOMB" ? (
            <>
              <mesh castShadow>
                <sphereGeometry args={[0.36, 12, 10]} />
                <meshStandardMaterial color="#1b1d2e" roughness={0.4} metalness={0.3} />
              </mesh>
              <mesh position={[0.18, 0.4, 0]} rotation={[0, 0, -0.5]}>
                <cylinderGeometry args={[0.04, 0.04, 0.35, 6]} />
                <meshStandardMaterial color="#c9b79c" />
              </mesh>
              <mesh position={[0.3, 0.58, 0]}>
                <sphereGeometry args={[0.1, 8, 8]} />
                <meshBasicMaterial color="#ffd32a" toneMapped={false} />
              </mesh>
            </>
          ) : (
            <>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.45, 0.07, 8, 24]} />
                <meshBasicMaterial color="#2ed573" toneMapped={false} />
              </mesh>
              <mesh position={[0, 0.35, 0]}>
                <octahedronGeometry args={[0.2, 0]} />
                <meshBasicMaterial color="#8fffb0" toneMapped={false} />
              </mesh>
            </>
          )}
        </group>
      ))}
    </group>
  );
}
