/**
 * Shared round phases so every mode, the HUD, the music and the camera agree
 * on "how tense is it right now":
 *
 *   LOBBY → COUNTDOWN → NORMAL → DANGER → (SUDDEN) → FINAL → WINNER
 *
 * DANGER is the run-up to the end (last 20 s, or the last 15 s before sudden
 * death in DROPZONE), SUDDEN is DROPZONE's sudden death, FINAL is the last
 * 10 s of the round whatever the mode.
 */
import { isSuddenDeath, roundEndAt } from "@/game/authority";
import { ARENA_RADIUS, COLOR_GRID, SPIN_RADIUS, TILE_SIZE, WALLS_HALF_X, WALLS_HALF_Z } from "@/game/config";
import { MELTDOWN_LAYER_RADII, MELTDOWN_LAYER_Y } from "@/game/meltdown";
import type { GameMode, GameState, Vec3 } from "@/types";

export type GamePhase = "LOBBY" | "COUNTDOWN" | "NORMAL" | "DANGER" | "SUDDEN" | "FINAL" | "WINNER";

export const FINAL_PHASE_MS = 10_000;
export const DANGER_PHASE_MS = 20_000;
export const SUMO_DANGER_MS = 15_000;

/** ms until the round is over no matter what (negative once it is). */
export function remainingMs(state: GameState, now: number): number {
  return roundEndAt(state) - now;
}

export function getPhase(state: GameState, now: number): GamePhase {
  if (state.status === "LOBBY") return "LOBBY";
  if (state.status === "COUNTDOWN") return "COUNTDOWN";
  if (state.status === "FINISHED") return "WINNER";
  const left = remainingMs(state, now);
  if (left <= FINAL_PHASE_MS) return "FINAL";
  if (isSuddenDeath(state, now)) return "SUDDEN";
  if (state.mode === "SUMO") return state.endAt - now <= SUMO_DANGER_MS ? "DANGER" : "NORMAL";
  return left <= DANGER_PHASE_MS ? "DANGER" : "NORMAL";
}

/** Distance from the player's feet to the nearest drop-off, or null when the mode has no simple edge. */
export function edgeDistance(mode: GameMode, p: Vec3): number | null {
  switch (mode) {
    case "SUMO":
    case "BOSS":
    case "TAG":
    case "BOMB":
    case "HILL":
    case "COIN":
    case "CROWN":
      return ARENA_RADIUS - Math.hypot(p.x, p.z);
    case "SPIN":
      return SPIN_RADIUS - Math.hypot(p.x, p.z);
    case "COLOR": {
      const half = (COLOR_GRID * TILE_SIZE) / 2;
      return half - Math.max(Math.abs(p.x), Math.abs(p.z));
    }
    case "WALLS":
      return Math.min(WALLS_HALF_X - Math.abs(p.x), WALLS_HALF_Z - Math.abs(p.z));
    case "MELTDOWN": {
      const layer = p.y < MELTDOWN_LAYER_Y[2] + 3 ? 2 : p.y < MELTDOWN_LAYER_Y[1] + 3 ? 1 : 0;
      return MELTDOWN_LAYER_RADII[layer] - Math.hypot(p.x, p.z);
    }
    default:
      return null;
  }
}
