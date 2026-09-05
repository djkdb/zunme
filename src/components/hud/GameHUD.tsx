"use client";

import { MuteButton } from "@/components/hud/MuteButton";
import { isSuddenDeath, roundEndAt } from "@/game/authority";
import { GAME_MODES } from "@/game/config";
import { RACE_CHECKPOINTS } from "@/game/race";
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

  const race = state.mode === "RACE";
  const meta = GAME_MODES[state.mode];
  const participants = state.participants.length ? state.participants : players.map((p) => p.id);
  const survivors = state.alive.length;
  const suddenDeath = isSuddenDeath(state, now);
  const remaining = state.status === "COUNTDOWN" ? meta.duration : roundEndAt(state) - now;
  const timeLabel = Math.max(0, Math.ceil(remaining / 1000));
  const hurry = race && state.finishOrder.length > 0;
  const final2 = !race && state.status === "PLAYING" && survivors === 2 && participants.length > 2;
  const isSpectating = !state.alive.includes(localId) && state.status === "PLAYING";
  const localFinished = race && state.finishOrder.includes(localId);
  const localCp = (state.progress[localId] ?? -1) + 1;
  const roster = participants.map((id) => players.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <div className="pointer-events-none absolute inset-0 z-10 safe-pad">
      {/* top bar */}
      <div className="flex items-start justify-between p-3">
        <div className="chip px-3 py-2 text-xs font-black tracking-widest text-white hud-text sm:text-sm">
          {meta.icon} {meta.name} · R{state.round}
        </div>
        <div className="chip anim-pop px-4 py-2 text-center text-white">
          <div className="text-[10px] font-bold tracking-[0.3em] text-white/60">{race ? "FINISHED" : "SURVIVORS"}</div>
          <div className="display text-2xl sm:text-3xl">
            {race ? state.finishOrder.length : survivors} <span className="text-white/50">/ {participants.length}</span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className={`chip px-3 py-2 text-center text-white ${suddenDeath || hurry ? "border-brand bg-brand/70" : ""}`}>
            <div className="text-[10px] font-bold tracking-[0.3em] text-white/70">{suddenDeath ? "SUDDEN" : hurry ? "HURRY" : "TIME"}</div>
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
          const finished = state.finishOrder.includes(p.id);
          const dim = race ? false : !alive;
          return (
            <li key={p.id} className={`chip flex items-center gap-2 px-3 py-1 text-xs font-bold transition-opacity ${dim ? "text-white/40 line-through" : "text-white"}`}>
              {dim ? <span className="text-[10px] text-white/50">✕</span> : <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.colorHex }} />}
              <span className="max-w-[110px] truncate">{p.nickname}</span>
              {race && (finished ? <span className="text-brand-2">🏁</span> : <span className="text-white/50">CP{(state.progress[p.id] ?? -1) + 1}</span>)}
            </li>
          );
        })}
      </ul>

      {/* race: local checkpoint chip */}
      {race && !localFinished && state.status === "PLAYING" && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2 sm:hidden">
          <div className="chip px-3 py-1 text-[11px] font-black tracking-widest text-white/85">
            CHECKPOINT {localCp} / {RACE_CHECKPOINTS.length}
          </div>
        </div>
      )}

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
      {(isSpectating || localFinished) && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="chip px-4 py-2 text-xs font-bold tracking-widest text-white/85">{localFinished ? "🏁 FINISHED — WAITING FOR OTHERS" : "SPECTATING"}</div>
        </div>
      )}
    </div>
  );
}
