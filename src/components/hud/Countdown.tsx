"use client";

import { useEffect, useRef, useState } from "react";
import { hostNow } from "@/game/clock";
import { sound } from "@/game/audio";
import { useGameStore } from "@/store/gameStore";

/** 3 · 2 · 1 · GO! driven by the host-synchronised start time. */
export function Countdown() {
  const startAt = useGameStore((s) => s.state.startAt);
  const status = useGameStore((s) => s.state.status);
  const [label, setLabel] = useState<string | null>(null);
  const lastLabel = useRef<string | null>(null);

  useEffect(() => {
    const active = status === "COUNTDOWN" || status === "PLAYING";
    let raf = 0;
    const tick = () => {
      const remaining = startAt - hostNow();
      let next: string | null;
      if (!active) next = null;
      else if (remaining > 0) next = String(Math.min(3, Math.ceil(remaining / 1000)));
      else if (remaining > -900) next = "시작!";
      else next = null;
      if (next !== lastLabel.current) {
        lastLabel.current = next;
        setLabel(next);
        if (next && next !== "시작!") sound.play("countdown");
      }
      if (active && (next !== null || remaining > -1000)) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [startAt, status]);

  if (!label) return null;
  const isGo = label === "시작!";
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center short:pt-24">
      <div key={label} className={`display anim-pop ${isGo ? "text-gradient gradient-shadow text-[120px] sm:text-[180px] short:text-[100px]" : "hud-text text-stroke text-[140px] text-white sm:text-[200px] short:text-[120px]"}`}>
        {label}
      </div>
    </div>
  );
}
