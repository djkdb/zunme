"use client";

import { useEffect, useState } from "react";
import { DASH_COOLDOWN } from "@/game/config";
import { localPose } from "@/game/remote";

/** Dash cooldown of the local player, sampled at 10 Hz for the HUD. */
export function useDashCooldown(): { dashLeft: number; dashPct: number } {
  const [state, setState] = useState({ dashLeft: 0, dashPct: 100 });
  useEffect(() => {
    const id = setInterval(() => {
      const dashLeft = Math.max(0, localPose.dashReadyAt - performance.now());
      const dashPct = Math.round((1 - dashLeft / DASH_COOLDOWN) * 100);
      setState((prev) => (prev.dashLeft === dashLeft && prev.dashPct === dashPct ? prev : { dashLeft, dashPct }));
    }, 100);
    return () => clearInterval(id);
  }, []);
  return state;
}
