/**
 * GameAuthority — the rules engine that decides when a round starts, who
 * is eliminated and who wins. It is deliberately free of React, Three.js
 * and networking so it can run on the host client today and be moved to
 * a real server (edge function / game server) later without changes.
 */
import {
  COUNTDOWN_DURATION,
  GAME_DURATION,
  SUDDEN_DEATH_DURATION,
} from "@/game/config";
import { randomSeed } from "@/game/random";
import type { ClientEvent, GameState } from "@/types";

export function createInitialState(hostId: string): GameState {
  return {
    status: "LOBBY",
    round: 0,
    seed: randomSeed(),
    countdownStartAt: 0,
    startAt: 0,
    endAt: 0,
    participants: [],
    alive: [],
    eliminationOrder: [],
    winnerId: null,
    hostId,
    version: 1,
  };
}

export class GameAuthority {
  state: GameState;
  private finishedAt = 0;
  private changed = false;

  constructor(state: GameState, hostId: string) {
    this.state = { ...state, hostId, version: state.version + 1 };
    this.changed = true;
  }

  /** Returns and clears the dirty flag. */
  consumeChanged(): boolean {
    const c = this.changed;
    this.changed = false;
    return c;
  }

  private commit(patch: Partial<GameState>) {
    this.state = { ...this.state, ...patch, version: this.state.version + 1 };
    this.changed = true;
  }

  startCountdown(participants: string[], now: number) {
    if (participants.length === 0) return;
    this.commit({
      status: "COUNTDOWN",
      round: this.state.round + 1,
      seed: randomSeed(),
      countdownStartAt: now,
      startAt: now + COUNTDOWN_DURATION,
      endAt: now + COUNTDOWN_DURATION + GAME_DURATION,
      participants: [...participants],
      alive: [...participants],
      eliminationOrder: [],
      winnerId: null,
    });
    this.finishedAt = 0;
  }

  returnToLobby() {
    if (this.state.status === "LOBBY") return;
    this.commit({ status: "LOBBY", participants: [], alive: [], eliminationOrder: [], winnerId: null });
  }

  handleEvent(evt: ClientEvent, now: number) {
    if (evt.type === "fall") this.eliminate(evt.playerId, now);
  }

  private eliminate(playerId: string, now: number) {
    const s = this.state;
    if (s.status !== "PLAYING" && s.status !== "COUNTDOWN") return;
    if (!s.alive.includes(playerId)) return;
    const alive = s.alive.filter((id) => id !== playerId);
    this.commit({ alive, eliminationOrder: [...s.eliminationOrder, playerId] });
    this.checkFinish(now);
  }

  private checkFinish(now: number) {
    const s = this.state;
    if (s.status !== "PLAYING") return;
    const total = s.participants.length;
    if (total >= 2 && s.alive.length <= 1) {
      this.finish(s.alive[0] ?? null, now);
    } else if (total === 1 && s.alive.length === 0) {
      this.finish(null, now);
    }
  }

  private finish(winnerId: string | null, now: number) {
    this.finishedAt = now;
    this.commit({ status: "FINISHED", winnerId, endAt: now });
  }

  /**
   * Advance time-driven transitions. `presentIds` lets the authority
   * eliminate players who disconnected mid-round.
   */
  tick(now: number, presentIds: string[]) {
    const s = this.state;
    if (s.status === "COUNTDOWN" && now >= s.startAt) {
      this.commit({ status: "PLAYING" });
    }
    if (this.state.status === "PLAYING" || this.state.status === "COUNTDOWN") {
      const gone = this.state.alive.filter((id) => !presentIds.includes(id));
      for (const id of gone) this.eliminate(id, now);
    }
    if (this.state.status === "PLAYING") {
      const hardEnd = this.state.startAt + GAME_DURATION + SUDDEN_DEATH_DURATION;
      if (now >= hardEnd) {
        // Time expired: the survivors tie, unless exactly one remains.
        const alive = this.state.alive;
        this.finish(alive.length === 1 ? alive[0] : null, now);
      }
    }
    if (this.state.status === "LOBBY" && this.state.participants.length > 0) {
      this.commit({ participants: [] });
    }
  }

  /** Convert all host-clock timestamps into a new clock (used on host handover). */
  rebase(offsetMs: number) {
    if (offsetMs === 0) return;
    const s = this.state;
    this.commit({
      countdownStartAt: s.countdownStartAt ? s.countdownStartAt - offsetMs : 0,
      startAt: s.startAt ? s.startAt - offsetMs : 0,
      endAt: s.endAt ? s.endAt - offsetMs : 0,
    });
  }
}

/** Ranking derived from a finished (or in-progress) state: survivors first, then reverse elimination order. */
export function computeRanking(state: GameState): string[] {
  const ranking: string[] = [];
  if (state.winnerId) ranking.push(state.winnerId);
  for (const id of state.alive) if (!ranking.includes(id)) ranking.push(id);
  for (let i = state.eliminationOrder.length - 1; i >= 0; i--) {
    const id = state.eliminationOrder[i];
    if (!ranking.includes(id)) ranking.push(id);
  }
  return ranking;
}

export function isSuddenDeath(state: GameState, hostNow: number): boolean {
  return state.status === "PLAYING" && hostNow >= state.startAt + GAME_DURATION;
}
