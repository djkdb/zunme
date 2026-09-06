"use client";

import { ACHIEVEMENTS, EMPTY_MODE_RECORD, levelFromXp } from "@/game/progression";
import { GAME_MODES } from "@/game/config";
import { isScoreMode } from "@/game/authority";
import type { GameMode } from "@/types";
import { missionDefs, useProgressStore } from "@/store/progressStore";

export function LevelBar({ compact = false }: { compact?: boolean }) {
  const xp = useProgressStore((s) => s.xp);
  const { level, into, need } = levelFromXp(xp);
  const pct = Math.min(100, Math.round((into / need) * 100));
  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "min-w-[160px]"}`}>
      <div className="display rounded-full bg-brand-2 px-2 py-0.5 text-sm text-[#12142b]">Lv.{level}</div>
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
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto scroll-y pr-1">
      <div className="text-[10px] font-bold tracking-[0.3em] text-white/50">오늘의 미션 · {daily.day}</div>
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
              <span className={`text-xs font-black ${m.done ? "text-brand-2" : "text-white/70"}`}>{m.done ? "완료 ✓" : `⭐ ${def.reward}`}</span>
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
        <Stat label="연승" value={`${streak}🔥`} />
        <Stat label="라운드" value={stats.rounds} />
        <Stat label="승리" value={stats.wins} />
      </div>
      <p className="text-[10px] font-semibold text-white/50">연승 보너스: 2연승 ×1.25 · 3연승 이상 ×1.5. 인원이 많을수록 더 받아요. 오래 살아남고 체크포인트를 지나면 추가 포인트.</p>
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
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scroll-y pr-1">
      <div className="mb-2 text-[10px] font-bold tracking-[0.3em] text-white/50">
        배지 · {unlocked.length} / {ACHIEVEMENTS.length}
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
              <div className={`mt-1.5 text-[10px] font-black tracking-widest ${has ? "text-brand-2" : "text-white/40"}`}>{has ? "달성" : `⭐ ${a.reward}`}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="최고 연승" value={stats.streakBest} />
        <Stat label="TOP 3" value={stats.top3} />
        <Stat label="최고 레이스 기록" value={stats.bestRaceMs ? `${(stats.bestRaceMs / 1000).toFixed(0)}s` : "—"} />
      </div>
    </div>
  );
}

function fmtMs(ms: number): string {
  if (ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`;
}

/** Personal records: lifetime totals plus a per-mode table. */
export function RecordsPanel() {
  const stats = useProgressStore((s) => s.stats);
  const xp = useProgressStore((s) => s.xp);
  const level = levelFromXp(xp).level;
  const modes = (Object.keys(GAME_MODES) as GameMode[]).filter((m) => (stats.byMode[m]?.plays ?? 0) > 0).sort((a, b) => (stats.byMode[b]?.plays ?? 0) - (stats.byMode[a]?.plays ?? 0));
  const winRate = stats.rounds > 0 ? Math.round((stats.wins / stats.rounds) * 100) : 0;
  const favourite = modes[0] ? GAME_MODES[modes[0]] : null;
  const bestMode = modes.length > 0 ? modes.map((m) => ({ m, r: stats.byMode[m] ?? EMPTY_MODE_RECORD })).filter((x) => x.r.plays >= 2).sort((a, b) => b.r.wins / b.r.plays - a.r.wins / a.r.plays)[0] : null;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scroll-y pr-1">
      <div className="mb-2 text-[10px] font-bold tracking-[0.3em] text-white/50">내 기록 · Lv.{level}</div>
      <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
        <Stat label="라운드" value={stats.rounds} />
        <Stat label="승리" value={stats.wins} />
        <Stat label="승률" value={`${winRate}%`} />
        <Stat label="TOP 3" value={stats.top3} />
        <Stat label="날린 수" value={stats.knockouts} />
        <Stat label="최고 연승" value={stats.streakBest} />
        <Stat label="시리즈 우승" value={stats.championships} />
        <Stat label="시리즈 완주" value={stats.seriesPlayed} />
        <Stat label="플레이 시간" value={fmtMs(stats.playMs)} />
        <Stat label="누적 포인트" value={stats.pointsLifetime} />
        <Stat label="최장 생존" value={fmtMs(stats.longestSurvivalMs)} />
        <Stat label="큰 방 (4+)" value={stats.bigRooms} />
      </div>
      {(favourite || bestMode) && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold text-white/85">
          {favourite && <span className="rounded-full bg-white/10 px-2.5 py-0.5">❤️ 최애 모드 {favourite.icon} {favourite.name}</span>}
          {bestMode && <span className="rounded-full bg-brand-2/20 px-2.5 py-0.5 text-brand-2">🏆 주특기 {GAME_MODES[bestMode.m].icon} {GAME_MODES[bestMode.m].name} · 승률 {Math.round((bestMode.r.wins / bestMode.r.plays) * 100)}%</span>}
        </div>
      )}
      <div className="mt-3 mb-1 text-[10px] font-bold tracking-[0.3em] text-white/50">모드별 기록</div>
      {modes.length === 0 ? (
        <p className="text-[11px] font-semibold text-white/55">아직 기록이 없어요. 한 판 하고 오면 여기 쌓여요.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white/5">
          <table className="w-full min-w-[300px] text-[11px] font-bold tabular-nums">
            <thead>
              <tr className="text-[9px] tracking-widest text-white/45">
                <th className="px-2 py-1 text-left">모드</th>
                <th className="px-1 py-1 text-right">판</th>
                <th className="px-1 py-1 text-right">승</th>
                <th className="px-1 py-1 text-right">TOP3</th>
                <th className="px-2 py-1 text-right">베스트</th>
              </tr>
            </thead>
            <tbody>
              {modes.map((m) => {
                const r = stats.byMode[m] ?? EMPTY_MODE_RECORD;
                const meta = GAME_MODES[m];
                const race = m === "RACE" || m === "GOGUN" || m === "TIPTOE" || m === "TOWER";
                const best = isScoreMode(m) ? (r.bestScore > 0 ? (m === "COIN" ? `🪙 ${r.bestScore}` : `${(r.bestScore / 1000).toFixed(1)}s`) : "—") : race ? (r.bestMs > 0 ? `⏱ ${fmtMs(r.bestMs)}` : "미완주") : r.bestKnockouts > 0 ? `💥 ${r.bestKnockouts} · ${fmtMs(r.bestMs)}` : fmtMs(r.bestMs);
                return (
                  <tr key={m} className="text-white/85">
                    <td className="px-2 py-1">{meta.icon} {meta.name}</td>
                    <td className="px-1 py-1 text-right">{r.plays}</td>
                    <td className={`px-1 py-1 text-right ${r.wins > 0 ? "text-brand-2" : ""}`}>{r.wins}</td>
                    <td className="px-1 py-1 text-right">{r.top3}</td>
                    <td className="px-2 py-1 text-right">{best}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
