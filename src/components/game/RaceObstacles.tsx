"use client";

import { useFrame } from "@react-three/fiber";
import {
  BallCollider,
  CuboidCollider,
  RigidBody,
  useBeforePhysicsStep,
  type CollisionPayload,
  type IntersectionEnterPayload,
  type IntersectionExitPayload,
  type RapierCollider,
  type RapierRigidBody,
} from "@react-three/rapier";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Sweeper, currentElapsed } from "@/components/game/Obstacles";
import { roundedTile } from "@/components/game/tileGeometry";
import { buildCrumbleSchedule, getTileState, type TileState } from "@/game/arena";
import { GAME_MODES, RACE_CONVEYOR_SPEED, RACE_JUMP_PAD_VELOCITY, RACE_WIND_SPEED, TILE_SIZE } from "@/game/config";
import { burst, shake } from "@/game/effects";
import {
  DOOR_COUNT,
  DOOR_WIDTH,
  fakeDoors,
  pendulumAngleAt,
  pistonXAt,
  type ConveyorDef,
  type FanDef,
  type PendulumDef,
  type PistonDef,
} from "@/game/race";
import { sound } from "@/game/audio";
import { onGameplayEvent, raceRuntime } from "@/game/sync";
import { useGameStore } from "@/store/gameStore";

type PlayerData = { type?: string; id?: string };

function isLocal(payload: { other: { rigidBody?: RapierRigidBody | null } }): boolean {
  const data = payload.other.rigidBody?.userData as PlayerData | undefined;
  return data?.type === "player" && data.id === useGameStore.getState().localId;
}

// ── Pendulum hammer ───────────────────────────────────────────────────
const PIVOT_Y = 8.5;
const ARM = 7.4;
const BALL_R = 1.15;

export function Pendulum({ def }: { def: PendulumDef }) {
  const body = useRef<RapierRigidBody>(null);
  const arm = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3());

  useBeforePhysicsStep(() => {
    const rb = body.current;
    if (!rb) return;
    const e = currentElapsed();
    const angle = Number.isFinite(e) && e > 0 ? pendulumAngleAt(def, e) : Math.sin(performance.now() * 0.0006) * 0.2;
    pos.current.set(def.x + Math.sin(angle) * ARM, PIVOT_Y - Math.cos(angle) * ARM, def.z);
    rb.setNextKinematicTranslation(pos.current);
    if (arm.current) arm.current.rotation.z = angle;
  });

  return (
    <group position={[def.x, 0, def.z]}>
      {/* gantry */}
      {[-1, 1].map((s) => (
        <mesh key={s} castShadow position={[s * 5.5, PIVOT_Y / 2, 0]}>
          <boxGeometry args={[0.5, PIVOT_Y, 0.5]} />
          <meshStandardMaterial color="#3a3f5c" roughness={0.7} flatShading />
        </mesh>
      ))}
      <mesh position={[0, PIVOT_Y, 0]}>
        <boxGeometry args={[11.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#3a3f5c" roughness={0.7} flatShading />
      </mesh>
      {/* arm (visual) */}
      <group ref={arm} position={[0, PIVOT_Y, 0]}>
        <mesh position={[0, -ARM / 2, 0]}>
          <cylinderGeometry args={[0.12, 0.12, ARM, 8]} />
          <meshStandardMaterial color="#c9b79c" roughness={0.6} metalness={0.3} />
        </mesh>
      </group>
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[0, PIVOT_Y - ARM, 0]} userData={{ type: "wall" }}>
        <BallCollider args={[BALL_R]} />
        <mesh castShadow>
          <sphereGeometry args={[BALL_R, 14, 10]} />
          <meshStandardMaterial color="#ff5a3c" roughness={0.45} flatShading />
        </mesh>
        <mesh>
          <torusGeometry args={[BALL_R * 0.9, 0.12, 8, 20]} />
          <meshStandardMaterial color="#ffd32a" roughness={0.5} />
        </mesh>
      </RigidBody>
    </group>
  );
}

// ── Door dash wall ────────────────────────────────────────────────────
export function DoorWall({ z, width }: { z: number; width: number }) {
  const seed = useGameStore((s) => s.state.seed);
  const fakes = useMemo(() => fakeDoors(seed), [seed]);
  const colliders = useRef<(RapierCollider | null)[]>(Array(DOOR_COUNT).fill(null));
  const doors = useRef<(THREE.Group | null)[]>(Array(DOOR_COUNT).fill(null));
  const open = useRef<boolean[]>(Array(DOOR_COUNT).fill(false));
  const openedAt = useRef<number[]>(Array(DOOR_COUNT).fill(0));
  const lastRound = useRef(-1);

  const pitch = width / DOOR_COUNT;
  const doorX = (i: number) => -width / 2 + pitch * (i + 0.5);
  const pillarW = pitch - DOOR_WIDTH;

  const openDoor = useCallback((i: number) => {
    if (open.current[i]) return;
    open.current[i] = true;
    openedAt.current[i] = performance.now();
    colliders.current[i]?.setEnabled(false);
    burst({ position: { x: doorX(i), y: 1.5, z }, color: ["#c9b79c", "#8a6a52", "#ffffff"], count: 22, speed: 4, life: 0.8, size: 0.16, gravity: 10 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z]);

  const resetDoors = useCallback(() => {
    for (let i = 0; i < DOOR_COUNT; i++) {
      open.current[i] = false;
      colliders.current[i]?.setEnabled(true);
      const g = doors.current[i];
      if (g) {
        g.rotation.x = 0;
        g.position.y = 0;
      }
    }
  }, []);

  useEffect(() => {
    const off = onGameplayEvent((evt) => {
      if (evt.k === "door") openDoor(evt.index);
    });
    const unsub = useGameStore.subscribe((s) => {
      if (s.state.round !== lastRound.current) {
        lastRound.current = s.state.round;
        resetDoors();
      }
    });
    return () => {
      off();
      unsub();
    };
  }, [openDoor, resetDoors]);

  const onHit = (i: number) => (payload: CollisionPayload) => {
    if (!isLocal(payload)) return;
    if (fakes.includes(i)) {
      if (open.current[i]) return;
      openDoor(i);
      useGameStore.getState().client?.broadcastGameplay({ k: "door", index: i });
      sound.play("impact", { volume: 0.9 });
      shake(0.35);
    } else {
      shake(0.2);
      sound.play("impact", { volume: 0.5, throttleMs: 300 });
    }
  };

  useFrame(() => {
    const now = performance.now();
    for (let i = 0; i < DOOR_COUNT; i++) {
      const g = doors.current[i];
      if (!g || !open.current[i]) continue;
      const k = Math.min(1, (now - openedAt.current[i]) / 500);
      g.rotation.x = -k * 1.5; // fall forward
      g.position.y = -k * 0.2;
    }
  });

  return (
    <group position={[0, 0, z]}>
      {/* pillars between and beside doors */}
      <RigidBody type="fixed" colliders={false}>
        {Array.from({ length: DOOR_COUNT + 1 }, (_, i) => -width / 2 + pitch * i).map((x, i) => (
          <group key={i}>
            <CuboidCollider args={[pillarW / 2 + 0.05, 1.6, 0.5]} position={[x, 1.6, 0]} />
            <mesh castShadow receiveShadow position={[x, 1.6, 0]}>
              <boxGeometry args={[pillarW + 0.1, 3.2, 1]} />
              <meshStandardMaterial color="#c9b79c" roughness={0.9} flatShading />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 3.4, 0]}>
          <boxGeometry args={[width + pillarW, 0.45, 1]} />
          <meshStandardMaterial color="#a88f6d" roughness={0.9} flatShading />
        </mesh>
      </RigidBody>
      {/* doors: every one looks identical, two are breakable (seeded) */}
      {Array.from({ length: DOOR_COUNT }, (_, i) => (
        <group key={i} position={[doorX(i), 0, 0]}>
          <RigidBody type="fixed" colliders={false} onCollisionEnter={onHit(i)}>
            <CuboidCollider ref={(c) => { colliders.current[i] = c; }} args={[DOOR_WIDTH / 2, 1.5, 0.15]} position={[0, 1.5, 0]} />
          </RigidBody>
          <group ref={(g) => { doors.current[i] = g; }}>
            <mesh castShadow position={[0, 1.5, 0]}>
              <boxGeometry args={[DOOR_WIDTH - 0.1, 2.9, 0.25]} />
              <meshStandardMaterial color="#ff8c5a" roughness={0.7} />
            </mesh>
            <mesh position={[0, 1.5, 0.14]}>
              <boxGeometry args={[DOOR_WIDTH - 0.6, 2.3, 0.04]} />
              <meshStandardMaterial color="#ffb489" roughness={0.7} />
            </mesh>
            <mesh position={[0.7, 1.4, 0.2]}>
              <sphereGeometry args={[0.12, 8, 6]} />
              <meshStandardMaterial color="#ffd32a" />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

// ── Conveyor belt ─────────────────────────────────────────────────────
let stripeTexture: THREE.CanvasTexture | null = null;
function getStripes(): THREE.CanvasTexture {
  if (stripeTexture) return stripeTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#2b2d42";
    ctx.fillRect(0, 0, 128, 32);
    ctx.fillStyle = "#ffd32a";
    ctx.beginPath();
    ctx.moveTo(20, 4);
    ctx.lineTo(60, 16);
    ctx.lineTo(20, 28);
    ctx.lineTo(36, 16);
    ctx.closePath();
    ctx.fill();
  }
  stripeTexture = new THREE.CanvasTexture(canvas);
  stripeTexture.wrapS = stripeTexture.wrapT = THREE.RepeatWrapping;
  stripeTexture.colorSpace = THREE.SRGBColorSpace;
  return stripeTexture;
}

export function Conveyor({ def }: { def: ConveyorDef }) {
  const texture = useMemo(() => {
    const t = getStripes().clone();
    t.needsUpdate = true;
    t.repeat.set(def.w / 2.5, 1);
    if (def.vx < 0) t.repeat.x *= -1;
    return t;
  }, [def.w, def.vx]);

  const belt = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    const map = (belt.current?.material as THREE.MeshStandardMaterial | undefined)?.map;
    if (map) map.offset.x -= (Math.abs(def.vx) / 2.5) * dt * 0.5;
  });

  const bind = (c: RapierCollider | null) => {
    if (c) raceRuntime.surfaces.set(c.handle, [Math.sign(def.vx) * RACE_CONVEYOR_SPEED, 0]);
  };

  return (
    <group position={[def.x, 0, def.z]}>
      <RigidBody type="fixed" colliders={false} userData={{ type: "ground" }}>
        <CuboidCollider ref={bind} args={[def.w / 2, 0.15, def.d / 2]} position={[0, 0.15, 0]} friction={1} />
      </RigidBody>
      <mesh receiveShadow position={[0, 0.15, 0]}>
        <boxGeometry args={[def.w, 0.3, def.d]} />
        <meshStandardMaterial color="#2b2d42" roughness={0.8} />
      </mesh>
      <mesh ref={belt} position={[0, 0.31, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[def.w, def.d]} />
        <meshStandardMaterial map={texture} roughness={0.9} />
      </mesh>
    </group>
  );
}

// ── Crumble bridge ────────────────────────────────────────────────────
const CRUMBLE_THICKNESS = 0.6;
const tmpMatrix = new THREE.Matrix4();
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpEuler = new THREE.Euler();
const tmpColor = new THREE.Color();
const CRUMBLE_A = new THREE.Color("#ffd4a8");
const CRUMBLE_B = new THREE.Color("#ffc994");
const CRUMBLE_WARN = new THREE.Color("#ff5a3c");
const CRUMBLE_GONE = new THREE.Color("#6b4f3a");

export function CrumbleBridge({ x, z, cols, rows }: { x: number; z: number; cols: number; rows: number }) {
  const seed = useGameStore((s) => s.state.seed);
  const count = cols * rows;
  const tiles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        return { x: x + (c - (cols - 1) / 2) * TILE_SIZE, z: z - (r - (rows - 1) / 2) * TILE_SIZE, checker: (c + r) % 2 === 0 };
      }),
    [x, z, cols, rows, count],
  );
  const schedule = useMemo(
    () => buildCrumbleSchedule(seed, count, { firstDelay: 2000, cycleMin: 2500, cycleMax: 6000, duration: GAME_MODES.RACE.duration + 30_000 }),
    [seed, count],
  );
  const mesh = useRef<THREE.InstancedMesh>(null);
  const colliders = useRef<(RapierCollider | null)[]>(Array(count).fill(null));
  const phases = useRef<TileState[]>(Array.from({ length: count }, () => ({ phase: "NORMAL", progress: 0, permanent: false })));
  const scratch = useRef<TileState>({ phase: "NORMAL", progress: 0, permanent: false });

  const bindMesh = useCallback(
    (m: THREE.InstancedMesh | null) => {
      if (!m) return;
      tiles.forEach((t, i) => {
        m.setMatrixAt(i, tmpMatrix.makeTranslation(t.x, -CRUMBLE_THICKNESS / 2, t.z));
        m.setColorAt(i, t.checker ? CRUMBLE_A : CRUMBLE_B);
      });
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    },
    [tiles],
  );

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const elapsed = currentElapsed();
    const now = performance.now();
    let matrixDirty = false;
    let colorDirty = false;
    for (let i = 0; i < count; i++) {
      const t = tiles[i];
      const prev = phases.current[i];
      const next = Number.isFinite(elapsed) ? getTileState(schedule[i], elapsed, scratch.current) : { phase: "NORMAL" as const, progress: 0, permanent: false };
      const changed = prev.phase !== next.phase;
      if (changed) {
        colliders.current[i]?.setEnabled(next.phase !== "COLLAPSED");
        if (next.phase === "COLLAPSED") burst({ position: { x: t.x, y: 0, z: t.z }, color: ["#ffc994", "#a06a45"], count: 10, speed: 3, life: 0.7, size: 0.15, gravity: 12 });
        prev.phase = next.phase;
      }
      let y = -CRUMBLE_THICKNESS / 2;
      let s = 1;
      let rx = 0;
      if (next.phase === "WARNING") {
        rx = Math.sin(now * 0.05 + i) * 0.04 * next.progress;
      } else if (next.phase === "COLLAPSED") {
        const p = next.progress;
        const drop = p < 0.75 ? Math.min(1, p / 0.2) : 1 - (p - 0.75) / 0.25;
        y -= drop * drop * 6;
        s = 1 - drop * drop * 0.9;
      }
      if (next.phase !== "NORMAL" || changed) {
        tmpPos.set(t.x, y, t.z);
        tmpQuat.setFromEuler(tmpEuler.set(rx, 0, -rx));
        tmpScale.setScalar(s);
        m.setMatrixAt(i, tmpMatrix.compose(tmpPos, tmpQuat, tmpScale));
        matrixDirty = true;
        if (next.phase === "WARNING") m.setColorAt(i, tmpColor.copy(t.checker ? CRUMBLE_A : CRUMBLE_B).lerp(CRUMBLE_WARN, 0.4 + 0.5 * next.progress));
        else if (next.phase === "COLLAPSED") m.setColorAt(i, CRUMBLE_GONE);
        else m.setColorAt(i, t.checker ? CRUMBLE_A : CRUMBLE_B);
        colorDirty = true;
      }
    }
    if (matrixDirty) m.instanceMatrix.needsUpdate = true;
    if (colorDirty && m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <RigidBody type="fixed" colliders={false} userData={{ type: "ground" }}>
        {tiles.map((t, i) => (
          <CuboidCollider key={i} ref={(c) => { colliders.current[i] = c; }} args={[TILE_SIZE * 0.49, CRUMBLE_THICKNESS / 2, TILE_SIZE * 0.49]} position={[t.x, -CRUMBLE_THICKNESS / 2, t.z]} friction={0.9} />
        ))}
      </RigidBody>
      <instancedMesh
        ref={(m) => {
          mesh.current = m;
          bindMesh(m);
        }}
        args={[undefined, undefined, count]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <primitive object={roundedTile(TILE_SIZE * 0.96, CRUMBLE_THICKNESS, TILE_SIZE * 0.96)} attach="geometry" />
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
    </group>
  );
}

// ── Jump pad ──────────────────────────────────────────────────────────
export function JumpPad({ x, z }: { x: number; z: number }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 4) * 0.08);
  });
  const onEnter = (payload: IntersectionEnterPayload) => {
    if (!isLocal(payload)) return;
    raceRuntime.launch = RACE_JUMP_PAD_VELOCITY;
    shake(0.25);
  };
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider sensor args={[2, 1, 2]} position={[0, 1, 0]} onIntersectionEnter={onEnter} />
      </RigidBody>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[2.2, 2.4, 0.24, 20]} />
        <meshStandardMaterial color="#2ed573" roughness={0.5} />
      </mesh>
      <mesh ref={ring} position={[0, 0.26, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.1, 1.7, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.27, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.7, 20]} />
        <meshBasicMaterial color="#ffd32a" />
      </mesh>
    </group>
  );
}

// ── Fan / wind zone ───────────────────────────────────────────────────
export function FanZone({ def, trackHalf }: { def: FanDef; trackHalf: number }) {
  const blades = useRef<THREE.Group>(null);
  const inside = useRef(false);
  useFrame((_, dt) => {
    if (blades.current) blades.current.rotation.z += dt * 12;
  });
  const onEnter = (payload: IntersectionEnterPayload) => {
    if (!isLocal(payload)) return;
    inside.current = true;
    raceRuntime.windX = def.dir * RACE_WIND_SPEED;
    raceRuntime.windZ = 0;
  };
  const onExit = (payload: IntersectionExitPayload) => {
    if (!isLocal(payload) || !inside.current) return;
    inside.current = false;
    raceRuntime.windX = 0;
    raceRuntime.windZ = 0;
  };
  const fanX = def.side * (trackHalf + 2.6);
  return (
    <group position={[0, 0, def.z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider sensor args={[trackHalf + 1, 2, def.d / 2]} position={[0, 2, 0]} onIntersectionEnter={onEnter} onIntersectionExit={onExit} />
      </RigidBody>
      {/* fan housing */}
      <group position={[fanX, 1.6, 0]} rotation={[0, (Math.PI / 2) * def.side, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[1.6, 1.6, 0.5, 20]} />
          <meshStandardMaterial color="#3a3f5c" roughness={0.6} flatShading />
        </mesh>
        <group ref={blades} rotation={[Math.PI / 2, 0, 0]}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]} position={[0, 0, 0]}>
              <boxGeometry args={[0.35, 2.6, 0.08]} />
              <meshStandardMaterial color="#18dcff" roughness={0.4} />
            </mesh>
          ))}
        </group>
        <mesh position={[0, -1.6, 0]}>
          <boxGeometry args={[0.5, 1.6, 0.5]} />
          <meshStandardMaterial color="#2b2d42" roughness={0.8} />
        </mesh>
      </group>
      {/* wind streaks */}
      {[-1.2, 0, 1.2].map((dz) => (
        <mesh key={dz} position={[0, 1.2 + Math.abs(dz) * 0.3, dz]}>
          <boxGeometry args={[trackHalf * 2 + 2, 0.04, 0.04]} />
          <meshBasicMaterial color="#e8f9ff" transparent opacity={0.35} />
        </mesh>
      ))}
    </group>
  );
}

// ── Piston (side punch) ───────────────────────────────────────────────
export function Piston({ def, trackHalf }: { def: PistonDef; trackHalf: number }) {
  return <Sweeper z={def.z} length={3.2} rotated height={1.4} color="#a55eea" xAt={(e) => pistonXAt(def, e, trackHalf)} />;
}


