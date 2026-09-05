"use client";

import { useEffect, useState } from "react";
import { roundEndAt } from "@/game/authority";
import { localPose } from "@/game/remote";
import { useHostClock } from "@/hooks/useHostClock";
import { useGameStore } from "@/store/gameStore";

/**
 * Full-screen CSS layers that react to gameplay: dash speed lines, stun
 * vignette, low-time pulse and the GO! flash. Polls the mutable pose at
 * 20 Hz instead of re-rendering per frame.
 */
export function ScreenEffects() {
  const [fx, setFx] = useState({ dashing: false, stunned: false });
  const status = useGameStore((s) => s.state.status);
  const state = useGameStore((s) => s.state);
  const now = useHostClock(250);

  useEffect(() => {
    const id = setInterval(() => {
      const t = performance.now();
      const next = { dashing: t < localPose.dashUntil, stunned: t < localPose.stunUntil };
      setFx((prev) => (prev.dashing === next.dashing && prev.stunned === next.stunned ? prev : next));
    }, 50);
    return () => clearInterval(id);
  }, []);

  // GO! flash: derived from the start time, no state needed.
  const flashing = status === "PLAYING" && now - state.startAt < 900;

  const remaining = status === "PLAYING" ? roundEndAt(state) - now : Infinity;
  const lowTime = remaining <= 10_000 && remaining > 0;

  return (
    <div className="pointer-events-none absolute inset-0 z-[15]">
      {fx.dashing && <div className="fx-speedlines absolute inset-0" />}
      {fx.stunned && <div className="fx-stun absolute inset-0" />}
      {lowTime && <div className="fx-lowtime absolute inset-0" />}
      {flashing && <div key={state.startAt} className="fx-flash absolute inset-0" />}
    </div>
  );
}
