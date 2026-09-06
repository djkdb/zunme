"use client";

import { useEffect, useRef, useState } from "react";
import { sound } from "@/game/audio";
import { hostNow } from "@/game/clock";
import { FINAL_PHASE_MS, remainingMs } from "@/game/phase";
import { useGameStore } from "@/store/gameStore";

/**
 * FINAL 10 SECONDS: a big 10 → 1 countdown for every timed mode, with a
 * tick per second and a harder hit for the last three. Driven by the host
 * clock via rAF so it never drifts from the HUD timer.
 */
export function FinalCountdown() {
  const status = useGameStore((s) => s.state.status);
  const [secs, setSecs] = useState<number | null>(null);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (status !== "PLAYING") return;
    let raf = 0;
    const tick = () => {
      const state = useGameStore.getState().state;
      const left = remainingMs(state, hostNow());
      const next = state.status === "PLAYING" && left <= FINAL_PHASE_MS && left > 0 ? Math.ceil(left / 1000) : null;
      if (next !== last.current) {
        last.current = next;
        setSecs(next);
        if (next !== null) sound.play(next <= 3 ? "final" : "tick", { volume: next <= 3 ? 0.9 : 0.5 });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  if (status !== "PLAYING" || secs === null) return null;
  const hot = secs <= 3;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[17%] z-20 flex flex-col items-center short:top-[14%]">
      <div key={secs} className={`display anim-slam hud-text text-stroke ${hot ? "text-[110px] text-brand sm:text-[150px] short:text-[84px]" : "text-[72px] text-white sm:text-[96px] short:text-[56px]"}`}>{secs}</div>
      <div className={`display -mt-2 rounded-full px-4 py-1 text-sm tracking-[0.3em] ${hot ? "bg-brand text-white" : "bg-[#12142b]/70 text-brand-2"}`}>{hot ? "FINAL" : "마지막 10초"}</div>
    </div>
  );
}
