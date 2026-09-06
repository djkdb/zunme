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
  /** GOGUN: coin points collected */
  coinPoints?: number;
  /** GOGUN: metres run */
  distance?: number;
  /** HILL / CROWN: ms held; COIN: coin points */
  score?: number;
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
  lines.push({ label: s.won ? "승리" : `${s.rank}위`, points: base });

  if (s.mode === "RACE") {
    if (s.finished) lines.push({ label: "코스 완주", points: 30 });
    if (s.checkpoints > 0) lines.push({ label: `체크포인트 ${s.checkpoints}개`, points: s.checkpoints * 8 });
  } else if (s.mode === "GOGUN") {
    if (s.finished) lines.push({ label: "골인", points: 40 });
    if (s.distance && s.distance > 0) lines.push({ label: `${Math.floor(s.distance)} m 주행`, points: Math.min(40, Math.floor(s.distance / 10)) });
    if (s.coinPoints && s.coinPoints > 0) lines.push({ label: "코인", points: Math.min(60, s.coinPoints) });
  } else if (s.mode === "TIPTOE" || s.mode === "TOWER") {
    if (s.finished) lines.push({ label: s.mode === "TOWER" ? "정상 도달" : "그리드 통과", points: 35 });
    if (s.checkpoints > 0) lines.push({ label: `진행 ${s.checkpoints}단계`, points: Math.min(30, s.checkpoints * 3) });
  } else if (s.mode === "COIN") {
    if (s.score && s.score > 0) lines.push({ label: `코인 ${s.score}점`, points: Math.min(45, s.score * 2) });
  } else if (s.mode === "HILL" || s.mode === "CROWN") {
    const sec = Math.floor((s.score ?? 0) / 1000);
    if (sec > 0) lines.push({ label: `${s.mode === "HILL" ? "언덕 위" : "왕관 착용"} ${sec}초`, points: Math.min(45, sec * 2) });
  } else {
    const survival = Math.min(30, Math.floor(s.survivedMs / 5000) * 2);
    if (survival > 0) lines.push({ label: `${Math.floor(s.survivedMs / 1000)}초 생존`, points: survival });
  }
  if (s.participants >= 6) lines.push({ label: "풀 방 (6명+)", points: Math.round(base * 0.2) });
  else if (s.participants >= 4) lines.push({ label: "큰 방 (4명+)", points: Math.round(base * 0.1) });

  let subtotal = lines.reduce((a, l) => a + l.points, 0);
  if (s.participants < 2) {
    const cut = -Math.round(subtotal * 0.5);
    lines.push({ label: "혼자 연습 (½)", points: cut });
    subtotal += cut;
  }
  const mult = s.won ? streakMultiplier(streak) : 1;
  if (mult > 1) lines.push({ label: `${streak}연승 ×${mult}`, points: Math.round(subtotal * (mult - 1)) });
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
  { id: "first_round", name: "첫 낙하", description: "첫 라운드를 플레이하세요.", emoji: "🪂", reward: 50, check: (s) => s.rounds >= 1 },
  { id: "first_win", name: "최후의 1인", description: "한 라운드 승리.", emoji: "🏆", reward: 100, check: (s) => s.wins >= 1 },
  { id: "wins_5", name: "골목대장", description: "5라운드 승리.", emoji: "💪", reward: 200, check: (s) => s.wins >= 5 },
  { id: "wins_25", name: "섬의 왕", description: "25라운드 승리.", emoji: "👑", reward: 600, check: (s) => s.wins >= 25 },
  { id: "all_modes", name: "삼관왕", description: "드롭존·스카이 대시·멜트다운 모두 승리.", emoji: "🎯", reward: 300, check: (s) => s.sumoWins > 0 && s.raceWins > 0 && s.meltdownWins > 0 },
  { id: "finisher", name: "완주자", description: "스카이 대시 완주.", emoji: "🏁", reward: 80, check: (s) => s.racesFinished >= 1 },
  { id: "ninja", name: "옥상 닌자", description: "고군분투 골인.", emoji: "🐱", reward: 150, check: (_, last) => last.mode === "GOGUN" && last.finished },
  { id: "speedster", name: "스피드스터", description: "스카이 대시 100초 안에 완주.", emoji: "⚡", reward: 250, check: (s) => s.bestRaceMs > 0 && s.bestRaceMs < 100_000 },
  { id: "survivor", name: "생존자", description: "한 라운드에서 60초 생존.", emoji: "🛡️", reward: 120, check: (s) => s.longestSurvivalMs >= 60_000 },
  { id: "party", name: "파티 타임", description: "6명 이상과 한 라운드 플레이.", emoji: "🎉", reward: 150, check: (_, last) => last.participants >= 6 },
  { id: "streak_3", name: "무적", description: "3연승.", emoji: "🔥", reward: 300, check: (s) => s.streakBest >= 3 },
  { id: "podium_10", name: "단골 시상대", description: "TOP 3 10회.", emoji: "🥉", reward: 200, check: (s) => s.top3 >= 10 },
  { id: "veteran", name: "베테랑", description: "50라운드 플레이.", emoji: "🎖️", reward: 400, check: (s) => s.rounds >= 50 },
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
  { id: "play_3", name: "3라운드 플레이", target: 3, reward: 80, emoji: "🎮", progress: () => 1 },
  { id: "win_1", name: "1승 달성", target: 1, reward: 120, emoji: "🏆", progress: (l) => (l.won ? 1 : 0) },
  { id: "top3_2", name: "TOP 3 두 번", target: 2, reward: 100, emoji: "🥉", progress: (l) => (l.rank <= 3 ? 1 : 0) },
  { id: "race_finish", name: "스카이 대시 완주", target: 1, reward: 110, emoji: "🏁", progress: (l) => (l.mode === "RACE" && l.finished ? 1 : 0) },
  { id: "gogun_300", name: "고군분투 300 m 달리기", target: 300, reward: 120, emoji: "🐱", progress: (l) => (l.mode === "GOGUN" ? Math.floor(l.distance ?? 0) : 0) },
  { id: "survive_45", name: "한 라운드 45초 생존", target: 1, reward: 90, emoji: "🛡️", progress: (l) => (l.mode !== "RACE" && l.survivedMs >= 45_000 ? 1 : 0) },
  { id: "meltdown_2", name: "멜트다운 두 번 플레이", target: 2, reward: 90, emoji: "🔥", progress: (l) => (l.mode === "MELTDOWN" ? 1 : 0) },
  { id: "sumo_win", name: "드롭존 승리", target: 1, reward: 130, emoji: "🥊", progress: (l) => (l.mode === "SUMO" && l.won ? 1 : 0) },
  { id: "checkpoints_6", name: "체크포인트 6개 통과", target: 6, reward: 100, emoji: "🚩", progress: (l) => (l.mode === "RACE" ? l.checkpoints : 0) },
  { id: "big_room", name: "4명 이상과 플레이", target: 1, reward: 100, emoji: "👥", progress: (l) => (l.participants >= 4 ? 1 : 0) },
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
