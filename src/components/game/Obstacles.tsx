"use client";

import { CuboidCollider, CylinderCollider, RigidBody, useBeforePhysicsStep, type RapierRigidBody } from "@react-three/rapier";
import { useRef } from "react";
import * as THREE from "three";
import { SPINNER_HEIGHT, SPINNER_LENGTH, WALL_LENGTH, WALL_Z } from "@/game/config";
import { spinnerAngle, wallPosition } from "@/game/arena";
import { elapsedSinceStart } from "@/game/clock";
import { useGameStore } from "@/store/gameStore";

const quat = new THREE.Quaternion();
const axisY = new THREE.Vector3(0, 1, 0);

function currentElapsed(): number {
  const state = useGameStore.getState().state;
  const active = state.status === "PLAYING" || state.status === "COUNTDOWN";
  return active ? elapsedSinceStart(state) : -Infinity;
}

/** Obstacle 1 — a long bar rotating around the centre pole. Jump over it! */
export function Spinner() {
  const body = useRef<RapierRigidBody>(null);
  const idle = useRef(0);

  useBeforePhysicsStep(() => {
    const rb = body.current;
    if (!rb) return;
    const elapsed = currentElapsed();
    let angle: number;
    if (Number.isFinite(elapsed) && elapsed > 0) {
      angle = spinnerAngle(elapsed);
      idle.current = angle;
    } else {
      idle.current += 0.004; // gentle ambient spin in lobby / results
      angle = idle.current;
    }
    quat.setFromAxisAngle(axisY, angle);
    rb.setNextKinematicRotation(quat);
  });

  const barY = SPINNER_HEIGHT + 0.35;
  return (
    <group>
      {/* pole */}
      <RigidBody type="fixed" colliders={false} userData={{ type: "pole" }}>
        <CylinderCollider args={[0.9, 0.45]} position={[0, 0.9, 0]} />
        <mesh castShadow receiveShadow position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.42, 0.5, 1.8, 10]} />
          <meshStandardMaterial color="#3a3f5c" roughness={0.6} metalness={0.3} flatShading />
        </mesh>
        <mesh position={[0, 1.85, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 0.14, 10]} />
          <meshStandardMaterial color="#ffd32a" roughness={0.5} />
        </mesh>
      </RigidBody>
      <RigidBody ref={body} type="kinematicPosition" colliders={false} userData={{ type: "spinner" }}>
        <CuboidCollider args={[SPINNER_LENGTH / 2, 0.2, 0.22]} position={[0, barY, 0]} />
        <mesh castShadow position={[0, barY, 0]}>
          <boxGeometry args={[SPINNER_LENGTH, 0.4, 0.44]} />
          <meshStandardMaterial color="#ff5a3c" roughness={0.5} />
        </mesh>
        {/* stripes */}
        {[-3, -1.5, 0, 1.5, 3].map((x) => (
          <mesh key={x} position={[x, barY, 0]}>
            <boxGeometry args={[0.7, 0.42, 0.46]} />
            <meshStandardMaterial color="#fff3d6" roughness={0.5} />
          </mesh>
        ))}
        {/* end caps */}
        {[-1, 1].map((s) => (
          <mesh key={s} castShadow position={[(s * SPINNER_LENGTH) / 2, barY, 0]}>
            <sphereGeometry args={[0.38, 10, 8]} />
            <meshStandardMaterial color="#ffd32a" roughness={0.4} />
          </mesh>
        ))}
      </RigidBody>
    </group>
  );
}

/** Obstacle 2 — a wall that sweeps back and forth across one side of the island. */
export function MovingWall() {
  const body = useRef<RapierRigidBody>(null);
  const pos = useRef(new THREE.Vector3(0, 0, 0));
  const WALL_H = 1.05;

  useBeforePhysicsStep(() => {
    const rb = body.current;
    if (!rb) return;
    const elapsed = currentElapsed();
    const x = Number.isFinite(elapsed) && elapsed > 0 ? wallPosition(elapsed) : 0;
    pos.current.set(x, 0, WALL_Z);
    rb.setNextKinematicTranslation(pos.current);
  });

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} userData={{ type: "wall" }}>
      <CuboidCollider args={[WALL_LENGTH / 2, WALL_H / 2, 0.35]} position={[0, WALL_H / 2, 0]} />
      <mesh castShadow receiveShadow position={[0, WALL_H / 2, 0]}>
        <boxGeometry args={[WALL_LENGTH, WALL_H, 0.7]} />
        <meshStandardMaterial color="#3d8bff" roughness={0.5} />
      </mesh>
      {[-2.4, -0.8, 0.8, 2.4].map((x) => (
        <mesh key={x} position={[x, WALL_H / 2, 0]}>
          <boxGeometry args={[0.5, WALL_H + 0.04, 0.74]} />
          <meshStandardMaterial color="#e8f1ff" roughness={0.5} />
        </mesh>
      ))}
      {/* runners */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * WALL_LENGTH) / 2, 0.2, 0]}>
          <boxGeometry args={[0.6, 0.4, 0.9]} />
          <meshStandardMaterial color="#2b2d42" roughness={0.7} />
        </mesh>
      ))}
    </RigidBody>
  );
}

export function Obstacles() {
  return (
    <>
      <Spinner />
      <MovingWall />
    </>
  );
}
