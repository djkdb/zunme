"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { Character, createAnim, type CharacterAnim } from "@/components/game/Character";
import type { Cosmetics } from "@/game/items";

function Turntable({ cosmetics, colorHex }: { cosmetics: Cosmetics; colorHex: string }) {
  const animRef = useRef<CharacterAnim>(createAnim());
  const group = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    const a = animRef.current;
    a.yaw += dt * 0.8;
    a.speed = 0;
    a.grounded = true;
    if (group.current) group.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.03 - 0.75;
  });
  return (
    <group ref={group} position={[0, -0.75, 0]}>
      <Character colorHex={colorHex} nickname="" animRef={animRef} showLabel={false} cosmetics={cosmetics} />
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.9, 24]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

/** Small turntable canvas showing the ZUN character with the given cosmetics. */
export function CharacterPreview({ cosmetics, colorHex }: { cosmetics: Cosmetics; colorHex: string }) {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ fov: 32, position: [0, 0.9, 4.2], near: 0.1, far: 50 }} gl={{ antialias: true, alpha: true }} style={{ position: "absolute", inset: 0 }}>
      <hemisphereLight args={["#cfe8ff", "#ffd6a5", 0.9]} />
      <directionalLight position={[3, 5, 4]} intensity={2} color="#fff4e0" />
      <Turntable cosmetics={cosmetics} colorHex={colorHex} />
    </Canvas>
  );
}
