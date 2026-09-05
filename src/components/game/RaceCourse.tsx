"use client";

import { CuboidCollider, RigidBody, type IntersectionEnterPayload } from "@react-three/rapier";
import { useMemo } from "react";
import * as THREE from "three";
import { Spinner, Sweeper } from "@/components/game/Obstacles";
import { Conveyor, CrumbleBridge, DoorWall, FanZone, JumpPad, Pendulum, Piston } from "@/components/game/RaceObstacles";
import { burst, shake } from "@/game/effects";
import {
  CRUMBLE_ORIGIN,
  DOOR_WALL_Z,
  JUMP_PAD,
  RACE_CHECKPOINTS,
  RACE_CONVEYORS,
  RACE_FANS,
  RACE_FINISH_Z,
  RACE_PENDULUMS,
  RACE_PISTONS,
  RACE_PLATFORMS,
  RACE_SPINNERS,
  RACE_SWEEPERS,
  TRACK_WIDTH,
  spinnerAngleAt,
  sweeperXAt,
} from "@/game/race";
import { livePoses } from "@/game/remote";
import { sound } from "@/game/audio";
import { raceRuntime } from "@/game/sync";
import { useGameStore } from "@/store/gameStore";

const PLATFORM_THICKNESS = 1.2;

function isLocalPlayer(payload: IntersectionEnterPayload): boolean {
  const data = payload.other.rigidBody?.userData as { type?: string; id?: string } | undefined;
  return data?.type === "player" && data.id === useGameStore.getState().localId;
}

function makeBannerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const cell = 32;
    for (let y = 0; y < canvas.height / cell; y++) {
      for (let x = 0; x < canvas.width / cell; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? "#12142b" : "#ffffff";
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    ctx.fillStyle = "rgba(255, 90, 60, 0.92)";
    ctx.fillRect(96, 24, 320, 80);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 64px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("FINISH", 256, 66);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function CheckpointArch({ z, halfWidth, index }: { z: number; halfWidth: number; index: number }) {
  const onEnter = (payload: IntersectionEnterPayload) => {
    if (!isLocalPlayer(payload)) return;
    if (raceRuntime.lastCheckpoint >= index) return;
    const cp = RACE_CHECKPOINTS[index];
    raceRuntime.lastCheckpoint = index;
    raceRuntime.respawn = cp.respawn;
    useGameStore.getState().reportCheckpoint(index);
    sound.play("countdown", { volume: 0.5 });
    const p = livePoses.get(useGameStore.getState().localId);
    if (p) burst({ position: { x: p.x, y: p.y + 1, z: p.z }, color: ["#ffd32a", "#ffffff"], count: 12, speed: 3, life: 0.5, size: 0.12 });
  };
  return (
    <group position={[0, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider sensor args={[halfWidth, 2.5, 0.4]} position={[0, 2.5, 0]} onIntersectionEnter={onEnter} />
      </RigidBody>
      {[-1, 1].map((s) => (
        <mesh key={s} castShadow position={[s * (halfWidth + 0.3), 2, 0]}>
          <boxGeometry args={[0.5, 4, 0.5]} />
          <meshStandardMaterial color="#ffd32a" roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 4.1, 0]}>
        <boxGeometry args={[halfWidth * 2 + 1.1, 0.35, 0.5]} />
        <meshStandardMaterial color="#ffd32a" roughness={0.5} />
      </mesh>
      <mesh position={[0, 4.55, 0]}>
        <boxGeometry args={[1.6, 0.55, 0.3]} />
        <meshStandardMaterial color="#12142b" roughness={0.5} />
      </mesh>
    </group>
  );
}

function FinishGate() {
  const texture = useMemo(() => makeBannerTexture(), []);
  const onEnter = (payload: IntersectionEnterPayload) => {
    if (!isLocalPlayer(payload) || raceRuntime.finished) return;
    raceRuntime.finished = true;
    useGameStore.getState().reportFinish();
    shake(0.4);
    sound.play("win");
    const p = livePoses.get(useGameStore.getState().localId);
    if (p) burst({ position: { x: p.x, y: p.y + 1.2, z: p.z }, color: ["#ffd32a", "#2ed573", "#ffffff", "#18dcff"], count: 36, speed: 5, life: 1.4, size: 0.14, gravity: 5 });
  };
  const half = TRACK_WIDTH / 2;
  return (
    <group position={[0, 0, RACE_FINISH_Z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider sensor args={[half, 3, 0.5]} position={[0, 3, 0]} onIntersectionEnter={onEnter} />
      </RigidBody>
      {[-1, 1].map((s) => (
        <mesh key={s} castShadow position={[s * (half + 0.4), 2.75, 0]}>
          <boxGeometry args={[0.7, 5.5, 0.7]} />
          <meshStandardMaterial color="#12142b" roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 5, 0]}>
        <boxGeometry args={[TRACK_WIDTH + 1.5, 1.6, 0.3]} />
        <meshStandardMaterial map={texture} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TRACK_WIDTH, 1.2]} />
        <meshStandardMaterial map={texture} roughness={0.8} />
      </mesh>
    </group>
  );
}

/** SKY DASH — a long obstacle course over the clouds. */
export function RaceCourse() {
  return (
    <group>
      <RigidBody type="fixed" colliders={false} userData={{ type: "ground" }}>
        {RACE_PLATFORMS.map((p, i) => (
          <group key={i}>
            <CuboidCollider args={[p.w / 2, PLATFORM_THICKNESS / 2, p.d / 2]} position={[p.x, -PLATFORM_THICKNESS / 2, p.z]} friction={0.9} />
            <mesh castShadow receiveShadow position={[p.x, -PLATFORM_THICKNESS / 2, p.z]}>
              <boxGeometry args={[p.w, PLATFORM_THICKNESS, p.d]} />
              <meshStandardMaterial color={p.color ?? "#f4f1ea"} roughness={0.85} />
            </mesh>
            <mesh position={[p.x, -PLATFORM_THICKNESS - 0.9, p.z]}>
              <boxGeometry args={[p.w * 0.8, 1.8, p.d * 0.8]} />
              <meshStandardMaterial color="#8a6a52" roughness={1} flatShading />
            </mesh>
          </group>
        ))}
      </RigidBody>

      {/* start line */}
      <mesh position={[0, 0.02, 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TRACK_WIDTH, 0.6]} />
        <meshBasicMaterial color="#ff5a3c" />
      </mesh>

      {RACE_SPINNERS.map((def, i) => (
        <Spinner key={i} position={[def.x, 0, def.z]} length={def.length} angleAt={(e) => spinnerAngleAt(def, e)} color={i % 2 ? "#a55eea" : "#ff5a3c"} />
      ))}
      <DoorWall z={DOOR_WALL_Z} width={12} />
      {RACE_CONVEYORS.map((def, i) => (
        <Conveyor key={i} def={def} />
      ))}
      {RACE_PENDULUMS.map((def, i) => (
        <Pendulum key={i} def={def} />
      ))}
      <CrumbleBridge x={CRUMBLE_ORIGIN.x} z={CRUMBLE_ORIGIN.z} cols={CRUMBLE_ORIGIN.cols} rows={CRUMBLE_ORIGIN.rows} />
      <JumpPad x={JUMP_PAD.x} z={JUMP_PAD.z} />
      {RACE_SWEEPERS.map((def, i) => (
        <Sweeper key={i} z={def.z} length={def.length} rotated xAt={(e) => (e > 0 ? sweeperXAt(def, e) : def.x)} color={i % 2 ? "#18dcff" : "#3d8bff"} />
      ))}
      {RACE_PISTONS.map((def, i) => (
        <Piston key={i} def={def} trackHalf={5.5} />
      ))}
      {RACE_FANS.map((def, i) => (
        <FanZone key={i} def={def} trackHalf={2.25} />
      ))}
      {RACE_CHECKPOINTS.map((cp) => (
        <CheckpointArch key={cp.index} z={cp.z} halfWidth={cp.halfWidth} index={cp.index} />
      ))}
      <FinishGate />
    </group>
  );
}
