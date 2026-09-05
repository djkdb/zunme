"use client";

import { useFrame } from "@react-three/fiber";
import {
  CapsuleCollider,
  RigidBody,
  useBeforePhysicsStep,
  useRapier,
  type CollisionPayload,
  type RapierRigidBody,
} from "@react-three/rapier";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { TRAIL_COLORS, type Cosmetics } from "@/game/items";
import { Character, createAnim, type CharacterAnim } from "@/components/game/Character";
import {
  JUMP_FORCE,
  OBSTACLE_PUSH_IMPULSE,
  PLAYER_ACCEL,
  PLAYER_AIR_CONTROL,
  PLAYER_HEIGHT,
  PLAYER_LINEAR_DAMPING,
  PLAYER_MASS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  PUSH_IMPULSE,
  PUSH_IMPULSE_MAX,
  PUSH_UPWARD,
} from "@/game/config";
import { burst, shake } from "@/game/effects";
import { consumeJump, input } from "@/game/input";
import { livePoses, localPose } from "@/game/remote";
import { sound } from "@/game/audio";
import { raceRuntime } from "@/game/sync";
import { useGameStore } from "@/store/gameStore";
import { isRoundActive } from "@/game/clock";

/** Mode-specific behaviour injected by the scene. */
export interface PlayerRules {
  /** below this y the player has fallen */
  fallY: number;
  /** "eliminate" reports the fall to the host; "respawn" teleports to `respawnAt()` */
  onFall: "eliminate" | "respawn";
  respawnAt?: () => [number, number, number];
  /** called every physics step with the collider the player stands on */
  onGround?: (colliderHandle: number) => void;
  /** surface velocity of the collider stood on (conveyor belts) */
  surfaceVelocity?: (colliderHandle: number) => [number, number] | undefined;
  /** horizontal velocity offset applied while in a wind zone */
  wind?: () => [number, number];
  /** returns a queued vertical launch velocity once, 0 otherwise */
  consumeLaunch?: () => number;
}

interface Props {
  id: string;
  nickname: string;
  colorHex: string;
  spawn: [number, number, number];
  showLabel: boolean;
  cosmetics: Cosmetics;
  rules: PlayerRules;
}

interface BodyUserData {
  type: "player" | "spinner" | "wall" | "pole";
  id?: string;
}

const tmpVel = new THREE.Vector3();
const tmpDir = new THREE.Vector3();

export function LocalPlayer({ id, nickname, colorHex, spawn, showLabel, rules, cosmetics }: Props) {
  const body = useRef<RapierRigidBody>(null);
  const animRef = useRef<CharacterAnim>(createAnim());
  const { world, rapier } = useRapier();
  const grounded = useRef(false);
  const fellReported = useRef(false);
  const rulesRef = useRef(rules);
  useEffect(() => {
    rulesRef.current = rules;
  }, [rules]);
  const lastRound = useRef(-1);
  const rayRef = useRef<InstanceType<typeof rapier.Ray> | null>(null);
  const halfHeight = (PLAYER_HEIGHT - PLAYER_RADIUS * 2) / 2;
  const lastTrail = useRef(0);

  // Dev-only hook so e2e tests / the console can move the local player.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const w = window as unknown as { __dropzone?: Record<string, unknown> };
    if (!w.__dropzone) w.__dropzone = {};
    w.__dropzone.teleport = (x: number, y: number, z: number) => {
      body.current?.setTranslation({ x, y, z }, true);
      body.current?.setLinvel({ x: 0, y: 0, z: 0 }, true);
    };
    return () => {
      delete w.__dropzone?.teleport;
    };
  }, []);

  // Reset to the spawn point whenever a new round begins.
  useEffect(() => {
    const unsub = useGameStore.subscribe((s) => {
      const rb = body.current;
      if (!rb) return;
      if (s.state.status === "COUNTDOWN" && s.state.round !== lastRound.current) {
        lastRound.current = s.state.round;
        fellReported.current = false;
        raceRuntime.reset();
        rb.setTranslation({ x: spawn[0], y: spawn[1], z: spawn[2] }, true);
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
        animRef.current.yaw = Math.atan2(-spawn[0], -spawn[2]);
      }
    });
    return unsub;
  }, [spawn]);

  useBeforePhysicsStep(() => {
    const rb = body.current;
    if (!rb) return;
    const anim = animRef.current;
    const t = rb.translation();
    const v = rb.linvel();

    // Ground probe from the capsule centre.
    if (!rayRef.current) rayRef.current = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
    const ray = rayRef.current;
    ray.origin.x = t.x;
    ray.origin.y = t.y;
    ray.origin.z = t.z;
    const hit = world.castRay(ray, PLAYER_HEIGHT / 2 + 0.12, true, undefined, undefined, undefined, rb);
    const wasGrounded = grounded.current;
    grounded.current = hit !== null && v.y <= 0.5;
    if (hit && grounded.current) rulesRef.current.onGround?.(hit.collider.handle);
    const surface = hit && grounded.current ? rulesRef.current.surfaceVelocity?.(hit.collider.handle) : undefined;
    const wind = rulesRef.current.wind?.();
    if (grounded.current && !wasGrounded && localPose.velocity.y < -4) {
      anim.landedAt = performance.now();
      burst({ position: { x: t.x, y: t.y - PLAYER_HEIGHT / 2, z: t.z }, color: "#ffffff", count: 6, speed: 2, life: 0.4, size: 0.12 });
    }

    const active = isRoundActive();
    const dt = 1 / 60;
    let mx = active ? input.moveX : 0;
    let mz = active ? -input.moveY : 0;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const control = grounded.current ? 1 : PLAYER_AIR_CONTROL;
    const targetX = mx * PLAYER_SPEED + (surface?.[0] ?? 0) + (wind?.[0] ?? 0);
    const targetZ = mz * PLAYER_SPEED + (surface?.[1] ?? 0) + (wind?.[1] ?? 0);
    const carried = Boolean(surface) || Boolean(wind && (wind[0] !== 0 || wind[1] !== 0));
    const maxDelta = PLAYER_ACCEL * control * dt;
    let vx = v.x + THREE.MathUtils.clamp(targetX - v.x, -maxDelta, maxDelta);
    let vz = v.z + THREE.MathUtils.clamp(targetZ - v.z, -maxDelta, maxDelta);
    // Extra ground friction when idle so shoves settle quickly.
    if (grounded.current && len < 0.05 && !carried) {
      vx *= 0.88;
      vz *= 0.88;
    }
    let vy = v.y;
    const wantsJump = consumeJump();
    if (active && wantsJump && grounded.current) {
      vy = JUMP_FORCE;
      grounded.current = false;
      anim.landedAt = 0;
      sound.play("jump", { volume: 0.6 });
      burst({ position: { x: t.x, y: t.y - PLAYER_HEIGHT / 2, z: t.z }, color: "#ffffff", count: 5, speed: 1.6, life: 0.35, size: 0.1 });
    }
    const launch = active ? (rulesRef.current.consumeLaunch?.() ?? 0) : 0;
    if (launch > 0) {
      vy = launch;
      grounded.current = false;
      sound.play("jump", { volume: 0.9 });
      burst({ position: { x: t.x, y: t.y - PLAYER_HEIGHT / 2, z: t.z }, color: ["#ffd32a", "#ffffff"], count: 14, speed: 3, life: 0.5, size: 0.14 });
    }
    rb.setLinvel({ x: vx, y: vy, z: vz }, true);

    if (len > 0.1) anim.yaw = Math.atan2(mx, mz);

    // Fell off
    const r = rulesRef.current;
    if (t.y < r.fallY && active) {
      if (r.onFall === "respawn" && r.respawnAt) {
        const [x, y, z] = r.respawnAt();
        rb.setTranslation({ x, y, z }, true);
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
        anim.yaw = 0;
        burst({ position: { x, y: y - 0.5, z }, color: ["#ffffff", colorHex], count: 14, speed: 3, life: 0.5, size: 0.14 });
        shake(0.3);
        sound.play("elimination", { volume: 0.5 });
      } else if (!fellReported.current) {
        fellReported.current = true;
        useGameStore.getState().reportFall();
      }
    }
  });

  useFrame(() => {
    const rb = body.current;
    if (!rb) return;
    const anim = animRef.current;
    const t = rb.translation();
    const v = rb.linvel();
    localPose.position.x = t.x;
    localPose.position.y = t.y - PLAYER_HEIGHT / 2;
    localPose.position.z = t.z;
    localPose.velocity.x = v.x;
    localPose.velocity.y = v.y;
    localPose.velocity.z = v.z;
    localPose.yaw = anim.yaw;
    localPose.grounded = grounded.current;
    livePoses.set(id, localPose.position);
    anim.speed = Math.hypot(v.x, v.z);
    anim.grounded = grounded.current;
    anim.vy = v.y;
    emitTrail(cosmetics.trail, localPose.position, anim.speed, grounded.current, lastTrail);

    useGameStore.getState().client?.sendSnapshot(() => ({
      p: [round(t.x), round(t.y - PLAYER_HEIGHT / 2), round(t.z)],
      r: round(anim.yaw),
      v: [round(v.x), round(v.y), round(v.z)],
      g: grounded.current,
    }));
  });

  const onCollisionEnter = (payload: CollisionPayload) => {
    const rb = body.current;
    const other = payload.other.rigidBody;
    if (!rb || !other) return;
    const anim = animRef.current;
    const data = (other.userData ?? {}) as BodyUserData;
    const me = rb.translation();
    const them = other.translation();
    const myVel = rb.linvel();
    const now = performance.now();

    if (data.type === "player") {
      tmpDir.set(me.x - them.x, 0, me.z - them.z);
      if (tmpDir.lengthSq() < 1e-4) tmpDir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      tmpDir.normalize();
      const otherVel = other.linvel();
      tmpVel.set(myVel.x - otherVel.x, 0, myVel.z - otherVel.z);
      const relative = tmpVel.length();
      const strength = THREE.MathUtils.clamp(PUSH_IMPULSE + relative * 0.45, PUSH_IMPULSE * 0.6, PUSH_IMPULSE_MAX) * PLAYER_MASS;
      rb.applyImpulse({ x: tmpDir.x * strength, y: PUSH_UPWARD * strength, z: tmpDir.z * strength }, true);
      anim.hitAt = now;
      localPose.lastImpactAt = now;
      const mid = { x: (me.x + them.x) / 2, y: me.y, z: (me.z + them.z) / 2 };
      burst({ position: mid, color: ["#ffffff", "#ffd32a", colorHex], count: 10, speed: 3, life: 0.45, size: 0.14 });
      shake(0.25 + Math.min(0.35, relative * 0.04));
      sound.play("impact", { volume: 0.7, throttleMs: 80 });
    } else if (data.type === "spinner") {
      // Tangential shove in the bar's direction of travel.
      tmpDir.set(me.z, 0, -me.x);
      if (tmpDir.lengthSq() < 1e-4) tmpDir.set(1, 0, 0);
      tmpDir.normalize();
      // Push slightly outward too, so it feels like being swept off.
      tmpVel.set(me.x, 0, me.z).normalize().multiplyScalar(0.35);
      tmpDir.add(tmpVel).normalize();
      rb.applyImpulse({ x: tmpDir.x * OBSTACLE_PUSH_IMPULSE, y: 2.2, z: tmpDir.z * OBSTACLE_PUSH_IMPULSE }, true);
      anim.hitAt = now;
      burst({ position: { x: me.x, y: me.y, z: me.z }, color: ["#ff5a3c", "#ffffff"], count: 12, speed: 3.5, life: 0.5, size: 0.14 });
      shake(0.45);
      sound.play("impact", { volume: 0.9, throttleMs: 120 });
    } else if (data.type === "wall") {
      // Push away from the wall's centre, horizontally.
      tmpDir.set(me.x - them.x, 0, me.z - them.z);
      if (tmpDir.lengthSq() < 1e-4) tmpDir.set(0, 0, 1);
      tmpDir.normalize();
      rb.applyImpulse({ x: tmpDir.x * OBSTACLE_PUSH_IMPULSE * 0.8, y: 1.5, z: tmpDir.z * OBSTACLE_PUSH_IMPULSE * 0.8 }, true);
      anim.hitAt = now;
      burst({ position: { x: me.x, y: me.y, z: me.z }, color: ["#3d8bff", "#ffffff"], count: 10, speed: 3, life: 0.45, size: 0.14 });
      shake(0.35);
      sound.play("impact", { volume: 0.8, throttleMs: 120 });
    }
  };

  return (
    <RigidBody
      ref={body}
      type="dynamic"
      colliders={false}
      position={spawn}
      mass={PLAYER_MASS}
      linearDamping={PLAYER_LINEAR_DAMPING}
      angularDamping={1}
      enabledRotations={[false, false, false]}
      ccd
      canSleep={false}
      userData={{ type: "player", id } satisfies BodyUserData}
      onCollisionEnter={onCollisionEnter}
    >
      <CapsuleCollider args={[halfHeight, PLAYER_RADIUS]} friction={0.2} restitution={0.15} />
      <group position={[0, -PLAYER_HEIGHT / 2, 0]}>
        <Character colorHex={colorHex} nickname={nickname} animRef={animRef} isLocal showLabel={showLabel} cosmetics={cosmetics} />
      </group>
    </RigidBody>
  );
}

/** Running trail particles for equipped trail cosmetics (throttled). */
export function emitTrail(trail: string, p: { x: number; y: number; z: number }, speed: number, grounded: boolean, last: { current: number }) {
  const colors = TRAIL_COLORS[trail];
  if (!colors || !grounded || speed < 2.5) return;
  const now = performance.now();
  if (now - last.current < 70) return;
  last.current = now;
  burst({ position: { x: p.x, y: p.y + 0.15, z: p.z }, color: colors, count: 2, speed: 1.2, life: 0.55, size: 0.11, gravity: trail === "fire" ? -3 : 1.5, spread: 0.6 });
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
