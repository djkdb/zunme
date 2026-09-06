/**
 * Head-count balance. Party rounds feel different with 2 players and with 8:
 * a duel ends fast, a crowd needs room and time. Everything here is derived from
 * `participants.length` in the shared state, so every client agrees.
 */
import type { GameMode } from "@/types";
import { GAME_MODES } from "@/game/config";
import { MODIFIERS, type ModifierId } from "@/game/modifiers";
import { MODE_GENRE } from "@/game/series";

/** Round-length multiplier by player count (survival / brawl / collect modes only). */
export function durationScale(mode: GameMode, players: number): number {
  const genre = MODE_GENRE[mode];
  if (genre === "race") return 1; // courses are fixed length
  if (players <= 2) return 0.8;
  if (players === 3) return 0.9;
  if (players <= 5) return 1;
  return 1.12;
}

/** Full round length in ms for a mode, head-count, and modifier. */
export function roundDuration(mode: GameMode, players: number, modifier: ModifierId = "NONE"): number {
  const base = GAME_MODES[mode].duration;
  return Math.round(base * durationScale(mode, players) * MODIFIERS[modifier].duration);
}

/** HOT POTATO: a duel passes the bomb back and forth, so fuses are shorter; a crowd gets longer ones. */
export function bombFuseScale(players: number): number {
  if (players <= 2) return 0.7;
  if (players === 3) return 0.85;
  if (players >= 6) return 1.15;
  return 1;
}

/** LAVA TOWER: with more racers the lava rises a bit faster so the pack can't camp. */
export function lavaSpeedScale(players: number): number {
  return players >= 5 ? 1.15 : players <= 2 ? 0.9 : 1;
}

/** COIN: with few players spawn fewer coins per wave so the piles are still contested. */
export function coinWaveScale(players: number): number {
  return players <= 2 ? 0.6 : players === 3 ? 0.8 : 1;
}
