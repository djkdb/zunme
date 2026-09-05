"use client";

import { ACHIEVEMENTS, levelFromXp } from "@/game/progression";
import { missionDefs, useProgressStore } from "@/store/progressStore";

export function LevelBar({ compact = false }: { compact?: boolean }) {
  const xp = useProgressStore((s) => s.xp);
  const { level, into, need } = levelFromXp(xp);
  const pct = Math.min(100, Math.round((into / need) * 100));
  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "min-w-[160px]"}`}>
      <div className="display rounded-full bg-brand-2 px-2 py-0.5 text-sm text-[#12142b]">LV {level}</div>
      {!compact && (
        <div className="flex-1">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-brand-2" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-0.5 text-[9px] font-bold tracking-widest text-white/50">
            {into} / {need} XP
          </div>
        </div>
      )}
    </div>
  );
}

export function MissionsPanel() {
  const daily = useProgressStore((s) => s.daily);
  const streak = useProgressStore((s) => s.streak);
  const stats = useProgressStore((s) => s.stats);
  const defs = missionDefs(daily.day);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
      <div className="text-[10px] font-bold tracking-[0.3em] text-white/50">TODAY&apos;S MISSIONS · {daily.day}</div>
      {daily.missions.map((m) => {
        const def = defs.find((d) => d.id === m.id);
        if (!def) return null;
        const pct = Math.round((m.progress / def.target) * 100);
        return (
          <div key={m.id} className={`rounded-2xl border-2 p-3 ${m.done ? "border-brand-2 bg-brand-2/10" : "border-white/10 bg-white/5"}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{def.emoji}</span>
                <span className="text-sm font-black text-white">{def.name}</span>
              </div>
              <span className={`text-xs font-black ${m.done ? "text-brand-2" : "text-white/70"}`}>{m.done ? "DONE ✓" : `⭐ ${def.reward}`}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-brand-2" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1 text-[10px] font-bold text-white/50">
              {m.progress} / {def.target}
            </div>
          </div>
        );
      })}
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <Stat label="WIN STREAK" value={`${streak}🔥`} />
        <Stat label="ROUNDS" value={stats.rounds} />
        <Stat label="WINS" value={stats.wins} />
      </div>
      <p className="text-[10px] font-semibold text-white/50">Streak bonus: 2 wins ×1.25 · 3+ wins ×1.5. Bigger rooms pay more. Survive longer and pass checkpoints for extra points.</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white/5 py-2">
      <div className="display text-lg text-white">{value}</div>
      <div className="text-[9px] font-bold tracking-widest text-white/50">{label}</div>
    </div>
  );
}

export function BadgesPanel() {
  const unlocked = useProgressStore((s) => s.achievements);
  const stats = useProgressStore((s) => s.stats);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
      <div className="mb-2 text-[10px] font-bold tracking-[0.3em] text-white/50">
        BADGES · {unlocked.length} / {ACHIEVEMENTS.length}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ACHIEVEMENTS.map((a) => {
          const has = unlocked.includes(a.id);
          return (
            <div key={a.id} className={`rounded-2xl border-2 p-2.5 ${has ? "border-brand-2 bg-brand-2/10" : "border-white/10 bg-white/5 opacity-70"}`}>
              <div className="flex items-center gap-2">
                <span className={`text-2xl ${has ? "" : "grayscale"}`}>{a.emoji}</span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-white">{a.name}</div>
                  <div className="text-[10px] font-semibold leading-tight text-white/55">{a.description}</div>
                </div>
              </div>
              <div className={`mt-1.5 text-[10px] font-black tracking-widest ${has ? "text-brand-2" : "text-white/40"}`}>{has ? "UNLOCKED" : `⭐ ${a.reward}`}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="BEST STREAK" value={stats.streakBest} />
        <Stat label="TOP 3" value={stats.top3} />
        <Stat label="BEST RACE" value={stats.bestRaceMs ? `${(stats.bestRaceMs / 1000).toFixed(0)}s` : "—"} />
      </div>
    </div>
  );
}
