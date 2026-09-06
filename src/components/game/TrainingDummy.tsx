"use client";

import { useFrame } from "@react-three/fiber";
import { CapsuleCollider, RigidBody } from "@react-three/rapier";
import { useMemo, useRef } from "react";
import { Character, createAnim, type CharacterAnim } from "@/components/game/Character";
import { PLAYER_HEIGHT, PLAYER_RADIUS } from "@/game/config";
import { DEFAULT_COSMETICS } from "@/game/items";

export const DUMMY_ID = "dummy";
/** written by the local player's collision handler */
export const dummyState = { hitAt: 0, hits: 0 };
const DUMMY_DATA = { type: "player", id: DUMMY_ID } as const;
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  const w = window as unknown as { __dropzone?: Record<string, unknown> };
  w.__dropzone = { ...(w.__dropzone ?? {}), dummy: dummyState };
}

/**
 * Lobby punching bag: a ZUN scarecrow you can shove and dash into while
 * waiting, so the first thing new players do is learn the hit feel.
 */
export function TrainingDummy({ position = [0, 0, -4.5] as [number, number, number] }: { position?: [number, number, number] }) {
  const animRef = useRef<CharacterAnim>(createAnim());
  const cosmetics = useMemo(() => ({ ...DEFAULT_COSMETICS, hat: "party" }), []);
  useFrame(() => {
    const a = animRef.current;
    a.hitAt = dummyState.hitAt;
    a.stunUntil = dummyState.hitAt + 350;
    a.yaw = Math.PI; // faces the spawn ring
    a.grounded = true;
  });
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false} userData={DUMMY_DATA}>
        <CapsuleCollider args={[(PLAYER_HEIGHT - PLAYER_RADIUS * 2) / 2, PLAYER_RADIUS]} position={[0, PLAYER_HEIGHT / 2, 0]} />
        <Character colorHex="#9aa3b8" nickname="연습용" animRef={animRef} showLabel cosmetics={cosmetics} />
      </RigidBody>
      {/* post it stands on */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.7, 0.95, 24]} />
        <meshBasicMaterial color="#ffd32a" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}
