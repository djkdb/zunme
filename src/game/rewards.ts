/** Placement lookup + per-round claim key. Point maths lives in progression.ts. */
import { computeRanking } from "@/game/authority";
import type { GameState } from "@/types";

export interface Reward {
  rank: number;
}

export function computeReward(state: GameState, playerId: string): Reward | null {
  if (state.status !== "FINISHED" || !state.participants.includes(playerId)) return null;
  const rank = computeRanking(state).indexOf(playerId) + 1;
  return rank > 0 ? { rank } : null;
}

/** Unique key per round so a reward is only granted once. */
export function rewardKey(state: GameState): string {
  return `${state.round}:${state.startAt}:${state.seed}`;
}
