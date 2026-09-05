/**
 * Progression rules: XP & levels, round bonuses, win streaks, achievements
 * and daily missions. Pure functions over a RoundSummary so the result
 * screen can explain exactly where every point came from.
 */
import { createRng } from "@/game/random";
import type { GameMode } from "@/types";

export interface RoundSummary {
  mode: GameMode;
  rank: number;
  participants: number;
  won: boolean;
  /** RACE: crossed the finish line */
  finished: boolean;
  /** ms the local player stayed in (elimination modes) or took to finish (race) */
  survivedMs: number;
  /** RACE: checkpoints passed */
  checkpoints: number;
  roundMs: number;
}

export interface Stats {
  rounds: number;
  wins: number;
  sumoWins: number;
  raceWins: number;
  meltdownWins: number;
  racesFinished: number;
  bestRaceMs: number; // 0 = none
  top3: number;
  longestSurvivalMs: number;
  bigRooms: number; // rounds with 4+ players
  streakBest: number;
  pointsLifetime: number;
}

export const EMPTY_STATS: Stats = {
  rounds: 0,
  wins: 0,
  sumoWins: 0,
  raceWins: 0,
  meltdownWins: 0,
  racesFinished: 0,
  bestRaceMs: 0,
  top3: 0,
  longestSurvivalMs: 0,
  bigRooms: 0,
  streakBest: 0,
  pointsLifetime: 0,
};

// ── XP / levels ──────────────────────────────────────────────────────
export const MAX_LEVEL = 50;
/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return 120 + level * 70;
}
export function levelFromXp(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let rest = xp;
  while (level < MAX_LEVEL && rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  return { level, into: rest, need: xpToNext(level) };
}
export const LEVEL_UP_BONUS = 50;

// ── Round points ─────────────────────────────────────────────────────
export interface PointLine {
  label: string;
  points: number;
}

export const RANK_POINTS = [100, 70, 50];
export const OTHER_RANK_POINTS = 30;
export const PARTICIPATION_POINTS = 20;

export function streakMultiplier(streak: number): number {
  if (streak >= 3) return 1.5;
  if (streak === 2) return 1.25;
  return 1;
}

/** Base placement points plus every bonus, itemised. `streak` = wins in a row including this one. */
export function roundPoints(s: RoundSummary, streak: number): PointLine[] {
  const lines: PointLine[] = [];
  let base = PARTICIPATION_POINTS + (RANK_POINTS[s.rank - 1] ?? OTHER_RANK_POINTS);
  if (s.mode !== "RACE" && !s.won && s.rank === 1) base = Math.round(base * 0.6); // draw
  lines.push({ label: s.won ? "Victory" : `Placed #${s.rank}`, points: base });

  if (s.mode === "RACE") {
    if (s.finished) lines.push({ label: "Finished the course", points: 30 });
    if (s.checkpoints > 0) lines.push({ label: `${s.checkpoints} checkpoint${s.checkpoints > 1 ? "s" : ""}`, points: s.checkpoints * 8 });
  } else {
    const survival = Math.min(30, Math.floor(s.survivedMs / 5000) * 2);
    if (survival > 0) lines.push({ label: `Survived ${Math.floor(s.survivedMs / 1000)}s`, points: survival });
  }
  if (s.participants >= 6) lines.push({ label: "Full room (6+)", points: Math.round(base * 0.2) });
  else if (s.participants >= 4) lines.push({ label: "Big room (4+)", points: Math.round(base * 0.1) });

  let subtotal = lines.reduce((a, l) => a + l.points, 0);
  if (s.participants < 2) {
    const cut = -Math.round(subtotal * 0.5);
    lines.push({ label: "Solo practice (½)", points: cut });
    subtotal += cut;
  }
  const mult = s.won ? streakMultiplier(streak) : 1;
  if (mult > 1) lines.push({ label: `${streak} win streak ×${mult}`, points: Math.round(subtotal * (mult - 1)) });
  return lines;
}

// ── Achievements ─────────────────────────────────────────────────────
export interface Achievement {
  id: string;
  name: string;
  description: string;
  emoji: string;
  reward: number;
  check: (stats: Stats, last: RoundSummary) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_round", name: "Dropped In", description: "Play your first round.", emoji: "🪂", reward: 50, check: (s) => s.rounds >= 1 },
  { id: "first_win", name: "Last One Standing", description: "Win a round.", emoji: "🏆", reward: 100, check: (s) => s.wins >= 1 },
  { id: "wins_5", name: "Bully", description: "Win 5 rounds.", emoji: "💪", reward: 200, check: (s) => s.wins >= 5 },
  { id: "wins_25", name: "Island King", description: "Win 25 rounds.", emoji: "👑", reward: 600, check: (s) => s.wins >= 25 },
  { id: "all_modes", name: "Triple Threat", description: "Win in all three modes.", emoji: "🎯", reward: 300, check: (s) => s.sumoWins > 0 && s.raceWins > 0 && s.meltdownWins > 0 },
  { id: "finisher", name: "Finisher", description: "Complete SKY DASH.", emoji: "🏁", reward: 80, check: (s) => s.racesFinished >= 1 },
  { id: "speedster", name: "Speedster", description: "Finish SKY DASH in under 100 s.", emoji: "⚡", reward: 250, check: (s) => s.bestRaceMs > 0 && s.bestRaceMs < 100_000 },
  { id: "survivor", name: "Survivor", description: "Stay alive 60 s in a single round.", emoji: "🛡️", reward: 120, check: (s) => s.longestSurvivalMs >= 60_000 },
  { id: "party", name: "Party Time", description: "Play a round with 6+ players.", emoji: "🎉", reward: 150, check: (_, last) => last.participants >= 6 },
  { id: "streak_3", name: "Unstoppable", description: "Win 3 rounds in a row.", emoji: "🔥", reward: 300, check: (s) => s.streakBest >= 3 },
  { id: "podium_10", name: "Podium Regular", description: "Finish top 3 ten times.", emoji: "🥉", reward: 200, check: (s) => s.top3 >= 10 },
  { id: "veteran", name: "Veteran", description: "Play 50 rounds.", emoji: "🎖️", reward: 400, check: (s) => s.rounds >= 50 },
];

// ── Daily missions ───────────────────────────────────────────────────
export interface MissionDef {
  id: string;
  name: string;
  target: number;
  reward: number;
  emoji: string;
  progress: (last: RoundSummary) => number;
}

export const MISSION_POOL: MissionDef[] = [
  { id: "play_3", name: "Play 3 rounds", target: 3, reward: 80, emoji: "🎮", progress: () => 1 },
  { id: "win_1", name: "Win a round", target: 1, reward: 120, emoji: "🏆", progress: (l) => (l.won ? 1 : 0) },
  { id: "top3_2", name: "Finish top 3 twice", target: 2, reward: 100, emoji: "🥉", progress: (l) => (l.rank <= 3 ? 1 : 0) },
  { id: "race_finish", name: "Finish SKY DASH", target: 1, reward: 110, emoji: "🏁", progress: (l) => (l.mode === "RACE" && l.finished ? 1 : 0) },
  { id: "survive_45", name: "Survive 45 s in a round", target: 1, reward: 90, emoji: "🛡️", progress: (l) => (l.mode !== "RACE" && l.survivedMs >= 45_000 ? 1 : 0) },
  { id: "meltdown_2", name: "Play MELTDOWN twice", target: 2, reward: 90, emoji: "🔥", progress: (l) => (l.mode === "MELTDOWN" ? 1 : 0) },
  { id: "sumo_win", name: "Win DROPZONE", target: 1, reward: 130, emoji: "🥊", progress: (l) => (l.mode === "SUMO" && l.won ? 1 : 0) },
  { id: "checkpoints_6", name: "Pass 6 checkpoints", target: 6, reward: 100, emoji: "🚩", progress: (l) => (l.mode === "RACE" ? l.checkpoints : 0) },
  { id: "big_room", name: "Play with 4+ players", target: 1, reward: 100, emoji: "👥", progress: (l) => (l.participants >= 4 ? 1 : 0) },
];

export function todayKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Three missions for a given day, deterministic from the date. */
export function dailyMissions(day: string): MissionDef[] {
  let seed = 0;
  for (const ch of day) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rng = createRng(seed);
  const pool = [...MISSION_POOL];
  const picked: MissionDef[] = [];
  while (picked.length < 3 && pool.length) picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return picked;
}
