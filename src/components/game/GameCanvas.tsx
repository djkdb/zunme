"use client";

import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Suspense, type ReactNode } from "react";
import * as THREE from "three";
import { CAMERA_FOV, GRAVITY } from "@/game/config";
import { MODIFIERS } from "@/game/modifiers";
import { useGameStore } from "@/store/gameStore";
import { PostFX } from "@/components/game/PostFX";

interface Props {
  children: ReactNode;
  mobile: boolean;
  /** Menu background: no interaction, cheaper settings. */
  ambient?: boolean;
}

const MENU_DPR: [number, number] = [1, 1.25];

/**
 * Shared Canvas config: ACES tone mapping, soft shadows, DPR capped for
 * mobile, and a manually stepped Rapier world (see PhysicsStepper).
 */
export function GameCanvas({ children, mobile, ambient = false }: Props) {
  const gravityScale = useGameStore((st) => MODIFIERS[st.state.modifier].gravity);
  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={ambient ? MENU_DPR : mobile ? [1, 1.5] : [1, 2]}
      camera={{ fov: CAMERA_FOV, near: 0.1, far: 900, position: [0, 14, 26] }}
      gl={{
        antialias: !mobile,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
        powerPreference: "high-performance",
      }}
      style={{ position: "absolute", inset: 0, touchAction: "none" }}
      eventSource={undefined}
      frameloop="always"
    >
      <Suspense fallback={null}>
        <Physics paused gravity={[0, GRAVITY * gravityScale, 0]} timeStep={1 / 60} interpolate={false} updateLoop="follow">
          {children}
        </Physics>
        <PostFX enabled={!mobile} />
      </Suspense>
    </Canvas>
  );
}
