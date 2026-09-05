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

/** ms since GO!, or -Infinity outside a round (obstacles then idle). */
export function currentElapsed(): number {
  const state = useGameStore.getState().state;
  const active = state.status === "PLAYING" || state.status === "COUNTDOWN";
  return active ? elapsedSinceStart(state) : -Infinity;
}

interface SpinnerProps {
  position?: [number, number, number];
  length?: number;
  /** bar bottom height above the floor */
  height?: number;
  /** angle in radians for a given elapsed ms */
  angleAt: (elapsed: number) => number;
  color?: string;
  showPole?: boolean;
}

/** A bar rotating around a centre pole. Jump over it! */
export function Spinner({ position = [0, 0, 0], length = SPINNER_LENGTH, height = SPINNER_HEIGHT, angleAt, color = "#ff5a3c", showPole = true }: SpinnerProps) {
  const body = useRef<RapierRigidBody>(null);
  const idle = useRef(0);

  useBeforePhysicsStep(() => {
    const rb = body.current;
    if (!rb) return;
    const elapsed = currentElapsed();
    let angle: number;
    if (Number.isFinite(elapsed) && elapsed > 0) {
      angle = angleAt(elapsed);
      idle.current = angle;
    } else {
      idle.current += 0.004; // gentle ambient spin in lobby / results
      angle = idle.current;
    }
    quat.setFromAxisAngle(axisY, angle);
    rb.setNextKinematicRotation(quat);
  });

  const barY = height + 0.2;
  const stripes = Math.max(3, Math.round(length / 3));
  return (
    <group position={position}>
      {showPole && (
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
      )}
      <RigidBody ref={body} type="kinematicPosition" colliders={false} userData={{ type: "spinner" }}>
        <CuboidCollider args={[length / 2, 0.2, 0.22]} position={[0, barY, 0]} />
        <mesh castShadow position={[0, barY, 0]}>
          <boxGeometry args={[length, 0.4, 0.44]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
        {Array.from({ length: stripes }, (_, i) => -length / 2 + ((i + 0.5) * length) / stripes).map((x) => (
          <mesh key={x} position={[x, barY, 0]}>
            <boxGeometry args={[0.7, 0.42, 0.46]} />
            <meshStandardMaterial color="#fff3d6" roughness={0.5} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={s} castShadow position={[(s * length) / 2, barY, 0]}>
            <sphereGeometry args={[0.38, 10, 8]} />
            <meshStandardMaterial color="#ffd32a" roughness={0.4} />
          </mesh>
        ))}
      </RigidBody>
    </group>
  );
}

interface SweeperProps {
  /** wall centre z (and y offset) */
  z: number;
  y?: number;
  /** wall length along x */
  length?: number;
  height?: number;
  /** x position for a given elapsed ms */
  xAt: (elapsed: number) => number;
  color?: string;
  /** rotate 90° so the wall spans z and pushes sideways (race sweepers) */
  rotated?: boolean;
}

/** A wall sliding back and forth along x. */
export function Sweeper({ z, y = 0, length = WALL_LENGTH, height = 1.05, xAt, color = "#3d8bff", rotated = false }: SweeperProps) {
  const body = useRef<RapierRigidBody>(null);
  const pos = useRef(new THREE.Vector3(0, y, z));

  useBeforePhysicsStep(() => {
    const rb = body.current;
    if (!rb) return;
    const elapsed = currentElapsed();
    const x = Number.isFinite(elapsed) && elapsed > 0 ? xAt(elapsed) : xAt(-1);
    pos.current.set(x, y, z);
    rb.setNextKinematicTranslation(pos.current);
  });

  const slats = Math.max(2, Math.round(length / 1.6));
  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[0, y, z]} rotation={[0, rotated ? Math.PI / 2 : 0, 0]} userData={{ type: "wall" }}>
      <CuboidCollider args={[length / 2, height / 2, 0.35]} position={[0, height / 2, 0]} />
      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[length, height, 0.7]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {Array.from({ length: slats }, (_, i) => -length / 2 + ((i + 0.5) * length) / slats).map((x) => (
        <mesh key={x} position={[x, height / 2, 0]}>
          <boxGeometry args={[0.5, height + 0.04, 0.74]} />
          <meshStandardMaterial color="#e8f1ff" roughness={0.5} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * length) / 2, 0.2, 0]}>
          <boxGeometry args={[0.6, 0.4, 0.9]} />
          <meshStandardMaterial color="#2b2d42" roughness={0.7} />
        </mesh>
      ))}
    </RigidBody>
  );
}

/** The DROPZONE (sumo) obstacle set: centre spinner + outer-ring sweeper. */
export function Obstacles() {
  return (
    <>
      <Spinner angleAt={spinnerAngle} />
      <Sweeper z={WALL_Z} xAt={(e) => (e > 0 ? wallPosition(e) : 0)} />
      <Sweeper z={-WALL_Z} xAt={(e) => (e > 0 ? -wallPosition(e + 1800) : 0)} color="#a55eea" />
    </>
  );
}
