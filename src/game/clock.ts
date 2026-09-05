/**
 * Game clock helpers that resolve host time via the active RoomClient.
 * Kept outside React so the frame loop can call them freely.
 */
import { useGameStore } from "@/store/gameStore";
import type { GameState } from "@/types";

export function hostNow(): number {
  const client = useGameStore.getState().client;
  return client ? client.now() : Date.now();
}

/** ms since GO! (negative during countdown). */
export function elapsedSinceStart(state: GameState = useGameStore.getState().state): number {
  if (!state.startAt) return -Infinity;
  return hostNow() - state.startAt;
}

export function isRoundActive(state: GameState = useGameStore.getState().state): boolean {
  return state.status === "PLAYING" || (state.status === "COUNTDOWN" && hostNow() >= state.startAt);
}
