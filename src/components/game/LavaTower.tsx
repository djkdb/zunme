"use client";

import { useFrame } from "@react-three/fiber";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { useRef } from "react";
import * as THREE from "three";
import { currentElapsed } from "@/components/game/Obstacles";
import { TOWER_STEP_Y } from "@/game/config";
import { TOWER_PLATFORM_LIST, TOWER_TOP_Y, lavaYAt } from "@/game/modes";
import { THEMES } from "@/game/theme";

const PLATFORM_COLORS = ["#f4f1ea", "#ffd9a0", "#ffb347"];

/** LAVA CLIMB — a spiral of platforms with lava rising underneath. */
export function LavaTower() {
  const lava = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const y = lavaYAt(currentElapsed());
    const now = performance.now();
    if (lava.current) {
      lava.current.position.y = y + Math.sin(now * 0.003) * 0.08;
      lava.current.rotation.z = now * 0.0002;
    }
    if (glow.current) {
      glow.current.position.y = y + 0.05;
      (glow.current.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.2 * Math.sin(now * 0.008);
    }
    if (light.current) {
      light.current.position.y = y + 2;
      light.current.intensity = 6 + Math.sin(now * 0.01) * 1.5;
    }
  });
  return (
    <group>
      {/* base */}
      <RigidBody type="fixed" colliders={false} userData={{ type: "ground" }}>
        <CylinderCollider args={[0.5, 5]} position={[0, -0.5, 0]} friction={0.9} />
        {TOWER_PLATFORM_LIST.map((p) => (
          <CylinderCollider key={p.index} args={[0.3, p.radius]} position={[p.x, p.y - 0.3, p.z]} friction={0.9} />
        ))}
      </RigidBody>
      <mesh position={[0, -0.5, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[5, 4.6, 1, 32]} />
        <meshStandardMaterial color="#f4f1ea" roughness={0.8} />
      </mesh>
      {TOWER_PLATFORM_LIST.map((p) => (
        <group key={p.index} position={[p.x, p.y - 0.3, p.z]}>
          <mesh receiveShadow castShadow>
            <cylinderGeometry args={[p.radius, p.radius - 0.2, 0.6, 20]} />
            <meshStandardMaterial color={p.index === TOWER_PLATFORM_LIST.length ? "#ffd32a" : PLATFORM_COLORS[p.index % 3]} roughness={0.75} />
          </mesh>
          {p.index % 4 === 0 && (
            <mesh position={[0, -1.2, 0]}>
              <boxGeometry args={[0.35, 1.8, 0.35]} />
              <meshStandardMaterial color="#5a3a30" roughness={0.9} flatShading />
            </mesh>
          )}
        </group>
      ))}
      {/* central column */}
      <mesh position={[0, TOWER_TOP_Y / 2, 0]}>
        <cylinderGeometry args={[1.6, 2.6, TOWER_TOP_Y + 4, 10]} />
        <meshStandardMaterial color="#3a2a30" roughness={0.9} flatShading />
      </mesh>
      {/* summit flag */}
      {(() => {
        const top = TOWER_PLATFORM_LIST[TOWER_PLATFORM_LIST.length - 1];
        return (
          <group position={[top.x, top.y, top.z]}>
            <mesh position={[0, 1.6, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 3.2, 6]} />
              <meshStandardMaterial color="#e8ecf4" />
            </mesh>
            <mesh position={[0.55, 2.7, 0]}>
              <boxGeometry args={[1.1, 0.7, 0.05]} />
              <meshStandardMaterial color="#ff4757" emissive="#ff4757" emissiveIntensity={0.4} />
            </mesh>
          </group>
        );
      })()}
      {/* height stripes on the column so the lava's progress reads */}
      {Array.from({ length: Math.floor(TOWER_TOP_Y / (TOWER_STEP_Y * 4)) }, (_, i) => (
        <mesh key={i} position={[0, (i + 1) * TOWER_STEP_Y * 4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.7, 2.0, 24]} />
          <meshBasicMaterial color={THEMES.TOWER.rim} transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* lava */}
      <mesh ref={lava} rotation={[-Math.PI / 2, 0, 0]} position={[0, -8, 0]}>
        <circleGeometry args={[40, 48]} />
        <meshStandardMaterial color="#ff5a1c" emissive="#ff3c00" emissiveIntensity={1.4} roughness={0.9} />
      </mesh>
      <mesh ref={glow} rotation={[-Math.PI / 2, 0, 0]} position={[0, -8, 0]}>
        <ringGeometry args={[2.8, 14, 48]} />
        <meshBasicMaterial color="#ffb060" transparent opacity={0.4} toneMapped={false} depthWrite={false} />
      </mesh>
      <pointLight ref={light} color="#ff7a3c" intensity={6} distance={30} decay={1.6} position={[0, -6, 0]} />
    </group>
  );
}
