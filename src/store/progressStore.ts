"use client";

/**
 * Progression state: stats, XP/level, win streak, achievements, daily
 * missions and the last round's point breakdown. Persisted in localStorage
 * next to the wallet. `applyRound` is the single entry point at round end.
 */
import { create } from "zustand";
import {
  ACHIEVEMENTS,
  EMPTY_STATS,
  LEVEL_UP_BONUS,
  dailyMissions,
  levelFromXp,
  roundPoints,
  todayKey,
  type MissionDef,
  type PointLine,
  type RoundSummary,
  type Stats,
} from "@/game/progression";
import { useWalletStore } from "@/store/walletStore";

const KEY = "dropzone:progress";

export interface MissionState {
  id: string;
  progress: number;
  done: boolean;
}

interface Persisted {
  stats: Stats;
  xp: number;
  streak: number;
  achievements: string[];
  daily: { day: string; missions: MissionState[] };
  claimed: string[];
}

export interface RoundReport {
  key: string;
  summary: RoundSummary;
  lines: PointLine[];
  levelUps: number[];
  achievements: string[];
  missions: string[];
  total: number;
}

interface ProgressStore extends Persisted {
  lastReport: RoundReport | null;
  applyRound(key: string, summary: RoundSummary): RoundReport | null;
  refreshDaily(): void;
}

function freshDaily(): Persisted["daily"] {
  const day = todayKey();
  return { day, missions: dailyMissions(day).map((m) => ({ id: m.id, progress: 0, done: false })) };
}

function load(): Persisted {
  const fresh: Persisted = { stats: { ...EMPTY_STATS }, xp: 0, streak: 0, achievements: [], daily: freshDaily(), claimed: [] };
  if (typeof window === "undefined") return fresh;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh;
    const p = JSON.parse(raw) as Partial<Persisted>;
    const daily = p.daily && p.daily.day === todayKey() && Array.isArray(p.daily.missions) ? p.daily : freshDaily();
    return {
      stats: { ...EMPTY_STATS, ...(p.stats ?? {}) },
      xp: Math.max(0, Number(p.xp) || 0),
      streak: Math.max(0, Number(p.streak) || 0),
      achievements: Array.isArray(p.achievements) ? p.achievements : [],
      daily,
      claimed: Array.isArray(p.claimed) ? p.claimed.slice(-50) : [],
    };
  } catch {
    return fresh;
  }
}

function save(p: Persisted) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function missionDefs(day: string): MissionDef[] {
  return dailyMissions(day);
}

export const useProgressStore = create<ProgressStore>((set) => ({
  ...load(),
  lastReport: null,

  refreshDaily() {
    const cur = load();
    set(cur);
  },

  applyRound(key, summary) {
    const cur = load();
    if (cur.claimed.includes(key)) return null;

    // stats
    const stats: Stats = { ...cur.stats };
    stats.rounds++;
    if (summary.won) {
      stats.wins++;
      if (summary.mode === "SUMO") stats.sumoWins++;
      if (summary.mode === "RACE") stats.raceWins++;
      if (summary.mode === "MELTDOWN") stats.meltdownWins++;
    }
    if (summary.mode === "RACE" && summary.finished) {
      stats.racesFinished++;
      if (stats.bestRaceMs === 0 || summary.survivedMs < stats.bestRaceMs) stats.bestRaceMs = summary.survivedMs;
    }
    if (summary.rank <= 3 && summary.participants >= 2) stats.top3++;
    if (summary.mode !== "RACE") stats.longestSurvivalMs = Math.max(stats.longestSurvivalMs, summary.survivedMs);
    if (summary.participants >= 4) stats.bigRooms++;
    const streak = summary.won ? cur.streak + 1 : 0;
    stats.streakBest = Math.max(stats.streakBest, streak);

    // points
    const lines = roundPoints(summary, streak);
    let total = lines.reduce((a, l) => a + l.points, 0);

    // achievements
    const unlocked: string[] = [];
    for (const a of ACHIEVEMENTS) {
      if (cur.achievements.includes(a.id) || unlocked.includes(a.id)) continue;
      if (a.check(stats, summary)) {
        unlocked.push(a.id);
        lines.push({ label: `${a.emoji} ${a.name}`, points: a.reward });
        total += a.reward;
      }
    }

    // daily missions
    const daily = cur.daily.day === todayKey() ? cur.daily : freshDaily();
    const defs = dailyMissions(daily.day);
    const completed: string[] = [];
    const missions = daily.missions.map((m) => {
      const def = defs.find((d) => d.id === m.id);
      if (!def || m.done) return m;
      const progress = Math.min(def.target, m.progress + def.progress(summary));
      const done = progress >= def.target;
      if (done) {
        completed.push(def.id);
        lines.push({ label: `미션: ${def.name}`, points: def.reward });
        total += def.reward;
      }
      return { id: m.id, progress, done };
    });

    // level: every point earned this round is XP (level-up bonus itself excluded)
    const before = levelFromXp(cur.xp).level;
    const xp = cur.xp + Math.max(0, total);
    const after = levelFromXp(xp).level;
    const levelUps: number[] = [];
    for (let l = before + 1; l <= after; l++) levelUps.push(l);
    if (levelUps.length) {
      const bonus = levelUps.length * LEVEL_UP_BONUS;
      lines.push({ label: `레벨 업 → ${after}`, points: bonus });
      total += bonus;
    }

    stats.pointsLifetime += total;
    const next: Persisted = {
      stats,
      xp,
      streak,
      achievements: [...cur.achievements, ...unlocked],
      daily: { day: daily.day, missions },
      claimed: [...cur.claimed, key].slice(-50),
    };
    save(next);
    useWalletStore.getState().claimReward(key, total, summary.rank);
    const report: RoundReport = { key, summary, lines, levelUps, achievements: unlocked, missions: completed, total };
    set({ ...next, lastReport: report });
    return report;
  },
}));

export function currentLevel(): number {
  return levelFromXp(useProgressStore.getState().xp).level;
}
