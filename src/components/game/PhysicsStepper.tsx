"use client";

import { useFrame } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import { getTimeScale } from "@/game/effects";

/**
 * Drives the (paused) Rapier world manually so that slow-motion can scale
 * the simulated delta. Fixed 60 Hz sub-steps are handled by rapier's
 * accumulator inside `step`.
 */
export function PhysicsStepper() {
  const { step } = useRapier();
  useFrame((_, dt) => {
    step(Math.min(dt, 0.1) * getTimeScale());
  });
  return null;
}
