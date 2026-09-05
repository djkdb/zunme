"use client";

import { MuteButton } from "@/components/hud/MuteButton";
import { GAME_DURATION, SUDDEN_DEATH_DURATION } from "@/game/config";
import { useHostClock } from "@/hooks/useHostClock";
import { selectPlayers, useGameStore } from "@/store/gameStore";

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function GameHUD() {
  const players = useGameStore(selectPlayers);
  const state = useGameStore((s) => s.state);
  const localId = useGameStore((s) => s.localId);
  const now = useHostClock(200);

  const participants = state.participants.length ? state.participants : players.map((p) => p.id);
  const survivors = state.alive.length;
  const elapsed = now - state.startAt;
  const suddenDeath = state.status === "PLAYING" && elapsed >= GAME_DURATION;
  const remaining = suddenDeath ? state.startAt + GAME_DURATION + SUDDEN_DEATH_DURATION - now : state.startAt + GAME_DURATION - now;
  const timeLabel = state.status === "COUNTDOWN" ? Math.ceil(GAME_DURATION / 1000) : Math.max(0, Math.ceil(remaining / 1000));
  const final2 = state.status === "PLAYING" && survivors === 2 && participants.length > 2;
  const isSpectating = !state.alive.includes(localId) && state.status === "PLAYING";
  const roster = participants.map((id) => players.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <div className="pointer-events-none absolute inset-0 z-10 safe-pad">
      {/* top bar */}
      <div className="flex items-start justify-between p-3">
        <div className="chip px-3 py-2 text-xs font-black tracking-widest text-white hud-text sm:text-sm">ROUND {state.round}</div>
        <div className="chip anim-pop px-4 py-2 text-center text-white">
          <div className="text-[10px] font-bold tracking-[0.3em] text-white/60">SURVIVORS</div>
          <div className="display text-2xl sm:text-3xl">
            {survivors} <span className="text-white/50">/ {participants.length}</span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className={`chip px-3 py-2 text-center text-white ${suddenDeath ? "border-brand bg-brand/70" : ""}`}>
            <div className="text-[10px] font-bold tracking-[0.3em] text-white/70">{suddenDeath ? "SUDDEN" : "TIME"}</div>
            <div className={`display text-2xl sm:text-3xl ${!suddenDeath && timeLabel <= 10 ? "text-brand-2" : ""}`}>{timeLabel}</div>
          </div>
          <div className="pointer-events-auto hidden sm:block">
            <MuteButton />
          </div>
        </div>
      </div>

      {/* roster */}
      <ul className="absolute left-3 top-20 hidden flex-col gap-1 sm:flex">
        {roster.map((p) => {
          const alive = state.alive.includes(p.id);
          return (
            <li key={p.id} className={`chip flex items-center gap-2 px-3 py-1 text-xs font-bold transition-opacity ${alive ? "text-white" : "text-white/40 line-through"}`}>
              {alive ? <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.colorHex }} /> : <span className="text-[10px] text-white/50">✕</span>}
              <span className="max-w-[110px] truncate">{p.nickname}</span>
            </li>
          );
        })}
      </ul>

      {/* banners */}
      {final2 && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2">
          <div className="anim-slam display rounded-2xl bg-brand px-6 py-2 text-3xl text-white shadow-2xl hud-text">FINAL 2</div>
        </div>
      )}
      {suddenDeath && !final2 && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2">
          <div className="anim-slam display rounded-2xl bg-brand px-6 py-2 text-2xl text-white shadow-2xl hud-text">SUDDEN DEATH</div>
        </div>
      )}
      {isSpectating && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="chip px-4 py-2 text-xs font-bold tracking-widest text-white/85">SPECTATING</div>
        </div>
      )}
    </div>
  );
}
