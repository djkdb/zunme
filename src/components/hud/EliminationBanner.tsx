"use client";

import { useGameStore } from "@/store/gameStore";

/** "ELIMINATED — name OUT" splash after every fall. Lifetime is CSS-driven (keyed by sequence). */
export function EliminationBanner() {
  const notice = useGameStore((s) => s.lastElimination);
  const seq = useGameStore((s) => s.eliminationSeq);
  const localId = useGameStore((s) => s.localId);
  const status = useGameStore((s) => s.state.status);

  if (!notice || (status !== "PLAYING" && status !== "FINISHED")) return null;
  const isYou = notice.playerId === localId;
  return (
    <div key={seq} className="anim-banner pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center">
      <div className="anim-slam display text-5xl text-brand hud-text sm:text-7xl">{isYou ? "YOU'RE OUT" : "ELIMINATED"}</div>
      <div className="anim-rise delay-1 mt-2 flex items-center gap-3">
        <span className="h-4 w-4 rounded-full" style={{ background: notice.colorHex, boxShadow: `0 0 14px ${notice.colorHex}` }} />
        <span className="display text-3xl text-white hud-text sm:text-4xl">{notice.nickname}</span>
        <span className="display text-3xl text-white/60 hud-text sm:text-4xl">OUT</span>
      </div>
    </div>
  );
}
