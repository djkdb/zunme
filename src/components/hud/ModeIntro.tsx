"use client";

import { GAME_MODES } from "@/game/config";
import { MODIFIERS } from "@/game/modifiers";
import { useHostClock } from "@/hooks/useHostClock";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useGameStore } from "@/store/gameStore";
import type { GameMode } from "@/types";

const CONTROL_HINT: Partial<Record<GameMode, { mobile: string; desktop: string }>> = {
  GOGUN: { mobile: "탭: 점프 · 공중에서 탭: 와이어", desktop: "SPACE: 점프 · 공중 SPACE: 와이어" },
};
const DEFAULT_HINT = { mobile: "조이스틱 이동 · 점프 · 대시로 밀치기", desktop: "WASD 이동 · SPACE 점프 · SHIFT 대시" };

/** "How to play" card shown during the countdown and the first moments of the round. */
export function ModeIntro() {
  const state = useGameStore((s) => s.state);
  const now = useHostClock(250);
  const mobile = useIsMobile();
  const meta = GAME_MODES[state.mode];
  const visible = state.status === "COUNTDOWN" || (state.status === "PLAYING" && now - state.startAt < 2500);
  if (!visible) return null;
  const hint = CONTROL_HINT[state.mode] ?? DEFAULT_HINT;
  const mod = MODIFIERS[state.modifier];
  return (
    <div key={state.round} className="pointer-events-none absolute inset-x-0 top-[72px] z-10 flex justify-center px-4 safe-pad short:top-16">
      <div className="anim-rise panel max-w-md px-4 py-2.5 text-center short:max-w-sm short:py-1.5">
        {state.seriesTotal > 1 && state.seriesRound > 0 && (
          <div className="mb-1 flex items-center justify-center gap-2 text-[10px] font-black tracking-[0.3em] text-white/70">
            <span className="rounded-full bg-brand-2 px-2 py-0.5 text-[#12142b]">PARTY SERIES</span>
            <span>{state.seriesRound === 1 ? `BEST OF ${state.seriesTotal} · ${state.seriesTotal}라운드 · 챔피언 1명` : `ROUND ${state.seriesRound} / ${state.seriesTotal}`}</span>
          </div>
        )}
        <div className="display text-lg text-brand-2 sm:text-xl">
          {meta.icon} {meta.name} <span className="text-white/60">· {meta.tagline}</span>
        </div>
        <p className="mt-0.5 text-[12px] font-semibold leading-snug text-white/85 short:text-[11px]">{meta.description}</p>
        {mod.id !== "NONE" && (
          <div className="anim-pop mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-brand-2/60 bg-brand-2/15 px-2.5 py-0.5 text-[11px] font-black text-brand-2">
            <span>🎲 {mod.icon} {mod.name}</span>
            <span className="font-bold text-white/75">· {mod.desc}</span>
          </div>
        )}
        <p className="mt-1 text-[10px] font-bold tracking-widest text-white/50">{mobile ? hint.mobile : hint.desktop}</p>
      </div>
    </div>
  );
}
