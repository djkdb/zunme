/** Points awarded at the end of a round. Deterministic from the final state so every client agrees. */
import { computeRanking } from "@/game/authority";
import type { GameState } from "@/types";

export const RANK_POINTS = [100, 70, 50];
export const PARTICIPATION_POINTS = 20;
export const OTHER_RANK_POINTS = 30;
export const RACE_FINISH_BONUS = 30;

export interface Reward {
  rank: number;
  points: number;
}

export function computeReward(state: GameState, playerId: string): Reward | null {
  if (state.status !== "FINISHED" || !state.participants.includes(playerId)) return null;
  const ranking = computeRanking(state);
  const rank = ranking.indexOf(playerId) + 1;
  if (rank <= 0) return null;
  let points = PARTICIPATION_POINTS + (RANK_POINTS[rank - 1] ?? OTHER_RANK_POINTS);
  if (state.mode === "RACE" && state.finishOrder.includes(playerId)) points += RACE_FINISH_BONUS;
  if (state.mode !== "RACE" && state.winnerId === null) points = Math.round(points * 0.6); // nobody won
  if (state.participants.length < 2) points = Math.round(points * 0.5); // solo practice
  return { rank, points };
}

/** Unique key per round so a reward is only granted once. */
export function rewardKey(state: GameState): string {
  return `${state.round}:${state.startAt}:${state.seed}`;
}
