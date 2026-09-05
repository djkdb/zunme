"use client";

import { useGameStore } from "@/store/gameStore";

/** "FINISH!" splash when someone crosses the line (RACE). Lifetime is CSS-driven. */
export function FinishBanner() {
  const notice = useGameStore((s) => s.lastFinish);
  const seq = useGameStore((s) => s.finishSeq);
  const localId = useGameStore((s) => s.localId);
  const state = useGameStore((s) => s.state);

  if (!notice || (state.mode !== "RACE" && state.mode !== "GOGUN") || (state.status !== "PLAYING" && state.status !== "FINISHED")) return null;
  const isYou = notice.playerId === localId;
  const place = state.finishOrder.indexOf(notice.playerId) + 1;
  return (
    <div key={seq} className="anim-banner pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center">
      <div className="anim-slam display text-gradient gradient-shadow text-5xl sm:text-7xl">{isYou ? "FINISH!" : "FINISHED"}</div>
      <div className="anim-rise delay-1 mt-2 flex items-center gap-3">
        <span className="h-4 w-4 rounded-full" style={{ background: notice.colorHex, boxShadow: `0 0 14px ${notice.colorHex}` }} />
        <span className="display text-3xl text-white hud-text sm:text-4xl">{notice.nickname}</span>
        <span className="display text-3xl text-white/70 hud-text sm:text-4xl">#{place}</span>
      </div>
    </div>
  );
}
