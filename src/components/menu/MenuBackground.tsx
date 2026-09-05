"use client";

import { Arena } from "@/components/game/Arena";
import { CameraController } from "@/components/game/CameraController";
import { Environment, Lighting } from "@/components/game/Environment";
import { GameCanvas } from "@/components/game/GameCanvas";
import { Obstacles } from "@/components/game/Obstacles";
import { PhysicsStepper } from "@/components/game/PhysicsStepper";

/** The island slowly orbiting behind the main menu. */
export function MenuBackground({ mobile }: { mobile: boolean }) {
  return (
    <GameCanvas mobile={mobile} ambient>
      <Lighting mobile={mobile} />
      <Environment mobile={mobile} />
      <PhysicsStepper />
      <Arena />
      <Obstacles />
      <CameraController menu />
    </GameCanvas>
  );
}
