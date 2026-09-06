/**
 * PARTY SERIES — several rounds, different modes, one champion.
 * Pure helpers over GameState: deterministic mode planning (seeded, so a
 * new host plans the same series), standings, and data-based "moments".
 */
import { GAME_MODES } from "@/game/config";
import { createRng } from "@/game/random";
import type { GameMode, GameState, SeriesRoundResult } from "@/types";

/** placement → series points (1st, 2nd, 3rd); everyone else 0 */
export const SERIES_POINTS = [3, 2, 1];
export const SERIES_OPTIONS = [1, 3, 5, 7] as const;
export const NEXT_GAME_DELAY_MS = 9_000;

type Genre = "brawl" | "race" | "survival" | "collect";
const GENRE: Record<GameMode, Genre> = {
  SUMO: "brawl",
  BOSS: "brawl",
  TAG: "brawl",
  BOMB: "brawl",
  CROWN: "brawl",
  HILL: "brawl",
  RACE: "race",
  GOGUN: "race",
  TIPTOE: "race",
  TOWER: "race",
  MELTDOWN: "survival",
  COLOR: "survival",
  WALLS: "survival",
  SPIN: "survival",
  COIN: "collect",
};

export function isSeries(state: GameState): boolean {
  return state.seriesTotal > 1;
}

/** true while a series is under way (started, not yet decided) */
export function seriesActive(state: GameState): boolean {
  return isSeries(state) && state.seriesRound > 0 && state.seriesChampion === null;
}

/**
 * Plan `total` modes from a seed. Rules: the host's picked mode opens the
 * series, no mode repeats until all playable ones were used, and consecutive
 * rounds never share a genre when avoidable. Same seed + same head-count →
 * same plan on every host.
 */
export function planSeriesModes(seed: number, total: number, playerCount: number, firstMode: GameMode): GameMode[] {
  const rng = createRng(seed ^ 0x5e71e5);
  const playable = (Object.keys(GAME_MODES) as GameMode[]).filter((m) => GAME_MODES[m].minPlayers <= playerCount);
  const plan: GameMode[] = [playable.includes(firstMode) ? firstMode : playable[0]];
  const used = new Set<GameMode>(plan);
  while (plan.length < total) {
    const prev = plan[plan.length - 1];
    let pool = playable.filter((m) => !used.has(m) && GENRE[m] !== GENRE[prev]);
    if (pool.length === 0) pool = playable.filter((m) => !used.has(m));
    if (pool.length === 0) {
      used.clear();
      pool = playable.filter((m) => m !== prev);
    }
    const pick = pool[Math.floor(rng() * pool.length)];
    plan.push(pick);
    used.add(pick);
  }
  return plan;
}

/** Points a placement earns. */
export function pointsForRank(rank: number): number {
  return SERIES_POINTS[rank - 1] ?? 0;
}

/** Ids sorted by series points; ties by round wins, then best single placement. */
export function seriesStandings(state: GameState, ids: string[] = state.participants): string[] {
  const wins = (id: string) => state.seriesRounds.filter((r) => r.winnerId === id).length;
  const best = (id: string) => Math.min(...state.seriesRounds.map((r) => r.ranking.indexOf(id)).filter((i) => i >= 0), 99);
  const last = state.seriesRounds[state.seriesRounds.length - 1];
  const lastRank = (id: string) => {
    const i = last ? last.ranking.indexOf(id) : -1;
    return i < 0 ? 99 : i;
  };
  const all = Array.from(new Set([...ids, ...Object.keys(state.series)]));
  return all.sort((a, b) => (state.series[b] ?? 0) - (state.series[a] ?? 0) || wins(b) - wins(a) || best(a) - best(b) || lastRank(a) - lastRank(b) || a.localeCompare(b));
}

/** Standings as they were before the given round result was applied. */
function standingsBefore(state: GameState, upTo: number): string[] {
  const pts: Record<string, number> = {};
  for (const r of state.seriesRounds) {
    if (r.round >= upTo) break;
    for (const [id, p] of Object.entries(r.points)) pts[id] = (pts[id] ?? 0) + p;
  }
  return Object.keys(pts).sort((a, b) => pts[b] - pts[a]);
}

/**
 * Short, data-backed callouts for the result screen: streaks, lead changes,
 * last-to-first, and how close the final was. Never random.
 */
export function seriesMoments(state: GameState, name: (id: string) => string): string[] {
  const rounds = state.seriesRounds;
  const out: string[] = [];
  if (!isSeries(state) || rounds.length === 0) return out;
  const last = rounds[rounds.length - 1];
  const winner = last.winnerId;
  // win streak
  if (winner) {
    let streak = 0;
    for (let i = rounds.length - 1; i >= 0 && rounds[i].winnerId === winner; i--) streak++;
    if (streak >= 2) out.push(`🔥 ${name(winner)} ${streak}연승!`);
  }
  // last → first
  if (winner && rounds.length >= 2) {
    const prev = rounds[rounds.length - 2];
    if (prev.ranking.length >= 3 && prev.ranking[prev.ranking.length - 1] === winner) out.push(`🚀 ${name(winner)} 꼴찌에서 1위로!`);
  }
  // lead change
  if (rounds.length >= 2) {
    const before = standingsBefore(state, last.round);
    const after = seriesStandings(state);
    if (before[0] && after[0] && before[0] !== after[0]) out.push(`🔁 ${name(after[0])} 선두 역전!`);
  }
  // final margin
  if (state.seriesChampion) {
    const s = seriesStandings(state);
    const gap = (state.series[s[0]] ?? 0) - (state.series[s[1]] ?? 0);
    if (s.length >= 2 && gap <= 1) out.push("😱 아슬아슬한 우승");
    else if (gap >= 4) out.push("👑 압도적인 우승");
  }
  return out.slice(0, 2);
}

export function roundResultLabel(r: SeriesRoundResult, id: string): string {
  const i = r.ranking.indexOf(id);
  if (i === 0) return "WIN";
  if (i === 1) return "2ND";
  if (i === 2) return "3RD";
  return i >= 0 ? `${i + 1}TH` : "—";
}
