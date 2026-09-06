"use client";

import { useFrame } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, useBeforePhysicsStep, type RapierRigidBody } from "@react-three/rapier";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Cosmetics } from "@/game/items";
import { Character, createAnim, type CharacterAnim } from "@/components/game/Character";
import { emitTrail } from "@/components/game/LocalPlayer";
import { BOSS_SCALE, PLAYER_HEIGHT, PLAYER_RADIUS } from "@/game/config";
import { MODIFIERS } from "@/game/modifiers";
import { hostNow } from "@/game/clock";
import { livePoses, remoteBuffers, type InterpolatedPose } from "@/game/remote";
import { useGameStore } from "@/store/gameStore";

interface Props {
  id: string;
  nickname: string;
  colorHex: string;
  spawn: [number, number, number];
  showLabel: boolean;
  cosmetics: Cosmetics;
  /** no collider: other runners are ghosts (GOGUN) */
  ghost?: boolean;
  boss?: boolean;
}

/**
 * Remote players are kinematic bodies moved along their interpolated
 * network path, so the local dynamic body collides with them for real.
 */
export function RemotePlayer({ id, nickname, colorHex, spawn, showLabel, cosmetics, ghost = false, boss = false }: Props) {
  const body = useRef<RapierRigidBody>(null);
  const animRef = useRef<CharacterAnim>(createAnim());
  const poseRef = useRef<InterpolatedPose>({ position: { x: spawn[0], y: spawn[1], z: spawn[2] }, yaw: 0, velocity: { x: 0, y: 0, z: 0 }, grounded: true, age: 0 });
  const liveRef = useRef({ x: spawn[0], y: spawn[1], z: spawn[2] });
  const smoothed = useRef(new THREE.Vector3(spawn[0], spawn[1], spawn[2]));
  const modScale = useGameStore((s) => MODIFIERS[s.state.modifier].scale);
  const scale = boss ? BOSS_SCALE : modScale;
  const halfHeight = ((PLAYER_HEIGHT - PLAYER_RADIUS * 2) / 2) * scale;
  const wasGrounded = useRef(true);
  const lastTrail = useRef(0);
  const userData = useMemo(() => ({ type: "player", id }), [id]);

  useBeforePhysicsStep(() => {
    const rb = body.current;
    if (!rb) return;
    const anim = animRef.current;
    const pose = poseRef.current;
    const buf = remoteBuffers.get(id);
    if (buf && buf.sample(hostNow(), pose)) {
      // Extra smoothing pass hides tick jitter.
      const target = pose.position;
      const s = smoothed.current;
      const dist = Math.hypot(target.x - s.x, target.y - s.y, target.z - s.z);
      const k = dist > 4 ? 1 : 0.5; // snap when far (respawn / teleport)
      s.x += (target.x - s.x) * k;
      s.y += (target.y - s.y) * k;
      s.z += (target.z - s.z) * k;
      rb.setNextKinematicTranslation({ x: s.x, y: s.y + (PLAYER_HEIGHT / 2) * scale, z: s.z });
      anim.yaw = pose.yaw;
      anim.speed = Math.hypot(pose.velocity.x, pose.velocity.z);
      anim.vy = pose.velocity.y;
      if (pose.grounded && !wasGrounded.current && pose.velocity.y < -3) anim.landedAt = performance.now();
      wasGrounded.current = pose.grounded;
      anim.grounded = pose.grounded;
    }
  });

  useFrame(() => {
    const rb = body.current;
    if (!rb) return;
    const t = rb.translation();
    const live = liveRef.current;
    live.x = t.x;
    live.y = t.y - (PLAYER_HEIGHT / 2) * scale;
    live.z = t.z;
    livePoses.set(id, live);
    const st = useGameStore.getState().state;
    animRef.current.celebrateUntil = st.status === "FINISHED" && (st.winnerId === id || st.seriesChampion === id) ? performance.now() + 200 : 0;
    emitTrail(cosmetics.trail, live, animRef.current.speed, animRef.current.grounded, lastTrail);
  });

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[spawn[0], spawn[1] + (PLAYER_HEIGHT / 2) * scale, spawn[2]]} userData={userData}>
      {!ghost && <CapsuleCollider args={[halfHeight, PLAYER_RADIUS * scale]} />}
      <group position={[0, (-PLAYER_HEIGHT / 2) * scale, 0]}>
        <Character colorHex={colorHex} nickname={nickname} animRef={animRef} showLabel={showLabel} cosmetics={cosmetics} scale={scale} />
      </group>
    </RigidBody>
  );
}
