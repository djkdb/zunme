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
import { Character, createAnim, type CharacterAnim } from "@/components/game/Character";
import {
  FALL_Y,
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
import { useGameStore } from "@/store/gameStore";
import { isRoundActive } from "@/game/clock";

interface Props {
  id: string;
  nickname: string;
  colorHex: string;
  spawn: [number, number, number];
  showLabel: boolean;
}

interface BodyUserData {
  type: "player" | "spinner" | "wall" | "pole";
  id?: string;
}

const tmpVel = new THREE.Vector3();
const tmpDir = new THREE.Vector3();

export function LocalPlayer({ id, nickname, colorHex, spawn, showLabel }: Props) {
  const body = useRef<RapierRigidBody>(null);
  const animRef = useRef<CharacterAnim>(createAnim());
  const { world, rapier } = useRapier();
  const grounded = useRef(false);
  const fellReported = useRef(false);
  const lastRound = useRef(-1);
  const rayRef = useRef<InstanceType<typeof rapier.Ray> | null>(null);
  const halfHeight = (PLAYER_HEIGHT - PLAYER_RADIUS * 2) / 2;

  // Reset to the spawn point whenever a new round begins.
  useEffect(() => {
    const unsub = useGameStore.subscribe((s) => {
      const rb = body.current;
      if (!rb) return;
      if (s.state.status === "COUNTDOWN" && s.state.round !== lastRound.current) {
        lastRound.current = s.state.round;
        fellReported.current = false;
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
    const targetX = mx * PLAYER_SPEED;
    const targetZ = mz * PLAYER_SPEED;
    const maxDelta = PLAYER_ACCEL * control * dt;
    let vx = v.x + THREE.MathUtils.clamp(targetX - v.x, -maxDelta, maxDelta);
    let vz = v.z + THREE.MathUtils.clamp(targetZ - v.z, -maxDelta, maxDelta);
    // Extra ground friction when idle so shoves settle quickly.
    if (grounded.current && len < 0.05) {
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
    rb.setLinvel({ x: vx, y: vy, z: vz }, true);

    if (len > 0.1) anim.yaw = Math.atan2(mx, mz);

    // Fell off the island
    if (t.y < FALL_Y && !fellReported.current && active) {
      fellReported.current = true;
      useGameStore.getState().reportFall();
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
      tmpDir.set(0, 0, Math.sign(me.z - them.z) || 1);
      rb.applyImpulse({ x: 0, y: 1.5, z: tmpDir.z * OBSTACLE_PUSH_IMPULSE * 0.8 }, true);
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
        <Character colorHex={colorHex} nickname={nickname} animRef={animRef} isLocal showLabel={showLabel} />
      </group>
    </RigidBody>
  );
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
