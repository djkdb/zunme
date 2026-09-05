"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";

/** Mutable animation input written by the owning controller every frame. */
export interface CharacterAnim {
  yaw: number;
  /** horizontal speed m/s */
  speed: number;
  grounded: boolean;
  vy: number;
  /** performance.now() of the last landing, for squash */
  landedAt: number;
  /** performance.now() of the last hit, for a flinch */
  hitAt: number;
}

export function createAnim(): CharacterAnim {
  return { yaw: 0, speed: 0, grounded: true, vy: 0, landedAt: 0, hitAt: 0 };
}

interface Props {
  colorHex: string;
  nickname: string;
  animRef: RefObject<CharacterAnim>;
  isLocal?: boolean;
  showLabel?: boolean;
}

function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.min(1, hsl.s * 1.05), THREE.MathUtils.clamp(hsl.l + amount, 0, 1));
  return `#${c.getHexString()}`;
}

/**
 * Low-poly character: boxy body, head with eyes, swinging arms and legs.
 * All animation is procedural and driven by `anim`, no React state per frame.
 */
export function Character({ colorHex, nickname, animRef, isLocal = false, showLabel = true }: Props) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const phase = useRef(-1);

  const colors = useMemo(
    () => ({
      body: colorHex,
      dark: shade(colorHex, -0.14),
      light: shade(colorHex, 0.12),
    }),
    [colorHex],
  );

  useFrame((_, dt) => {
    const g = root.current;
    const anim = animRef.current;
    if (!g || !anim) return;
    if (phase.current < 0) phase.current = Math.random() * Math.PI * 2;
    const now = performance.now();
    g.rotation.y = anim.yaw;

    const moving = anim.speed > 0.4;
    const target = moving ? Math.min(1, anim.speed / 7) : 0;
    phase.current += dt * (6 + anim.speed * 1.4) * (moving || !anim.grounded ? 1 : 0.5);
    const swing = Math.sin(phase.current) * 0.9 * target;

    // Landing squash + hit flinch (time-based, so it's independent of framerate).
    const sinceLand = (now - anim.landedAt) / 1000;
    const squash = sinceLand < 0.25 ? Math.sin((sinceLand / 0.25) * Math.PI) * 0.18 : 0;
    const sinceHit = (now - anim.hitAt) / 1000;
    const flinch = sinceHit < 0.3 ? Math.sin((sinceHit / 0.3) * Math.PI) * 0.35 : 0;

    if (anim.grounded) {
      if (legL.current) legL.current.rotation.x = swing;
      if (legR.current) legR.current.rotation.x = -swing;
      if (armL.current) armL.current.rotation.x = -swing * 0.8;
      if (armR.current) armR.current.rotation.x = swing * 0.8;
    } else {
      // Airborne: arms up, legs tucked
      const up = THREE.MathUtils.clamp(anim.vy / 8, -1, 1);
      if (legL.current) legL.current.rotation.x = THREE.MathUtils.lerp(legL.current.rotation.x, 0.5, dt * 10);
      if (legR.current) legR.current.rotation.x = THREE.MathUtils.lerp(legR.current.rotation.x, -0.3, dt * 10);
      if (armL.current) armL.current.rotation.x = THREE.MathUtils.lerp(armL.current.rotation.x, -2.4 + up * 0.4, dt * 10);
      if (armR.current) armR.current.rotation.x = THREE.MathUtils.lerp(armR.current.rotation.x, -2.4 - up * 0.4, dt * 10);
      if (armL.current) armL.current.rotation.z = 0.4;
      if (armR.current) armR.current.rotation.z = -0.4;
    }
    if (anim.grounded && armL.current && armR.current) {
      armL.current.rotation.z = THREE.MathUtils.lerp(armL.current.rotation.z, 0.12, dt * 10);
      armR.current.rotation.z = THREE.MathUtils.lerp(armR.current.rotation.z, -0.12, dt * 10);
    }

    if (body.current) {
      const bob = anim.grounded ? Math.abs(Math.sin(phase.current)) * 0.06 * target : 0;
      body.current.position.y = bob - squash * 0.5;
      body.current.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6);
      body.current.rotation.x = THREE.MathUtils.lerp(body.current.rotation.x, target * 0.18 - flinch * 0.6, dt * 8);
    }
    if (head.current) {
      head.current.rotation.z = Math.sin(phase.current * 0.5) * 0.05 * target;
      head.current.rotation.x = -flinch * 0.4;
    }
  });

  return (
    <group ref={root}>
      <group ref={body} position={[0, 0, 0]}>
        {/* torso */}
        <mesh castShadow receiveShadow position={[0, 0.72, 0]}>
          <boxGeometry args={[0.62, 0.66, 0.42]} />
          <meshStandardMaterial color={colors.body} roughness={0.55} flatShading />
        </mesh>
        {/* belly stripe */}
        <mesh position={[0, 0.58, 0.215]}>
          <boxGeometry args={[0.4, 0.22, 0.02]} />
          <meshStandardMaterial color={colors.light} roughness={0.6} />
        </mesh>
        {/* head */}
        <group ref={head} position={[0, 1.27, 0]}>
          <mesh castShadow position={[0, 0, 0]}>
            <boxGeometry args={[0.54, 0.5, 0.5]} />
            <meshStandardMaterial color={colors.light} roughness={0.5} flatShading />
          </mesh>
          {/* visor / face plate */}
          <mesh position={[0, -0.02, 0.255]}>
            <boxGeometry args={[0.42, 0.26, 0.02]} />
            <meshStandardMaterial color="#1a1c2c" roughness={0.3} metalness={0.2} />
          </mesh>
          {/* eyes */}
          <mesh position={[-0.11, 0, 0.275]}>
            <boxGeometry args={[0.08, 0.12, 0.02]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.6} />
          </mesh>
          <mesh position={[0.11, 0, 0.275]}>
            <boxGeometry args={[0.08, 0.12, 0.02]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.6} />
          </mesh>
          {/* antenna */}
          <mesh position={[0, 0.32, 0]}>
            <boxGeometry args={[0.06, 0.16, 0.06]} />
            <meshStandardMaterial color={colors.dark} />
          </mesh>
          <mesh position={[0, 0.42, 0]}>
            <sphereGeometry args={[0.07, 8, 6]} />
            <meshStandardMaterial color={colors.body} emissive={colors.body} emissiveIntensity={0.5} />
          </mesh>
        </group>
        {/* arms */}
        <group ref={armL} position={[-0.4, 0.98, 0]}>
          <mesh castShadow position={[0, -0.26, 0]}>
            <boxGeometry args={[0.16, 0.52, 0.16]} />
            <meshStandardMaterial color={colors.dark} roughness={0.6} flatShading />
          </mesh>
          <mesh position={[0, -0.55, 0]}>
            <boxGeometry args={[0.19, 0.12, 0.19]} />
            <meshStandardMaterial color={colors.light} roughness={0.6} />
          </mesh>
        </group>
        <group ref={armR} position={[0.4, 0.98, 0]}>
          <mesh castShadow position={[0, -0.26, 0]}>
            <boxGeometry args={[0.16, 0.52, 0.16]} />
            <meshStandardMaterial color={colors.dark} roughness={0.6} flatShading />
          </mesh>
          <mesh position={[0, -0.55, 0]}>
            <boxGeometry args={[0.19, 0.12, 0.19]} />
            <meshStandardMaterial color={colors.light} roughness={0.6} />
          </mesh>
        </group>
      </group>
      {/* legs */}
      <group ref={legL} position={[-0.16, 0.42, 0]}>
        <mesh castShadow position={[0, -0.2, 0]}>
          <boxGeometry args={[0.2, 0.42, 0.22]} />
          <meshStandardMaterial color={colors.dark} roughness={0.6} flatShading />
        </mesh>
        <mesh position={[0, -0.4, 0.04]}>
          <boxGeometry args={[0.22, 0.1, 0.3]} />
          <meshStandardMaterial color="#2b2d42" roughness={0.7} />
        </mesh>
      </group>
      <group ref={legR} position={[0.16, 0.42, 0]}>
        <mesh castShadow position={[0, -0.2, 0]}>
          <boxGeometry args={[0.2, 0.42, 0.22]} />
          <meshStandardMaterial color={colors.dark} roughness={0.6} flatShading />
        </mesh>
        <mesh position={[0, -0.4, 0.04]}>
          <boxGeometry args={[0.22, 0.1, 0.3]} />
          <meshStandardMaterial color="#2b2d42" roughness={0.7} />
        </mesh>
      </group>
      {showLabel && (
        <Html position={[0, 1.95, 0]} center distanceFactor={14} zIndexRange={[1, 0]} style={{ pointerEvents: "none" }}>
          <div
            className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-bold tracking-wide shadow-lg backdrop-blur-sm ${
              isLocal ? "bg-white/90 text-slate-900" : "bg-slate-900/70 text-white"
            }`}
            style={{ borderBottom: `3px solid ${colorHex}` }}
          >
            {nickname}
          </div>
        </Html>
      )}
    </group>
  );
}
