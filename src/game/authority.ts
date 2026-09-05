/**
 * GameAuthority — the rules engine that decides when a round starts, who
 * is eliminated, who finished and who wins. It is deliberately free of
 * React, Three.js and networking so it can run on the host client today
 * and be moved to a real server (edge function / game server) later.
 *
 * Modes:
 *  - SUMO / MELTDOWN: elimination, last survivor wins (SUMO has sudden death)
 *  - RACE: no elimination; first to the finish line wins, others ranked by
 *    finish order then by checkpoint progress
 */
import { COUNTDOWN_DURATION, DEFAULT_MODE, GAME_MODES, RACE_FINISH_GRACE } from "@/game/config";
import { randomSeed } from "@/game/random";
import type { ClientEvent, GameMode, GameState } from "@/types";

export function createInitialState(hostId: string): GameState {
  return {
    status: "LOBBY",
    mode: DEFAULT_MODE,
    round: 0,
    seed: randomSeed(),
    countdownStartAt: 0,
    startAt: 0,
    endAt: 0,
    participants: [],
    alive: [],
    eliminationOrder: [],
    finishOrder: [],
    progress: {},
    winnerId: null,
    hostId,
    version: 1,
  };
}

/** Wall-clock (host) time at which the round is over no matter what. */
export function roundEndAt(state: GameState): number {
  return state.endAt + (state.mode === "SUMO" ? GAME_MODES.SUMO.suddenDeath : 0);
}

export function isEliminationMode(mode: GameMode): boolean {
  return mode !== "RACE";
}

export class GameAuthority {
  state: GameState;
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

  setMode(mode: GameMode) {
    if (this.state.mode === mode) return;
    if (this.state.status !== "LOBBY" && this.state.status !== "FINISHED") return;
    this.commit({ mode });
  }

  startCountdown(participants: string[], now: number) {
    if (participants.length === 0) return;
    const duration = GAME_MODES[this.state.mode].duration;
    this.commit({
      status: "COUNTDOWN",
      round: this.state.round + 1,
      seed: randomSeed(),
      countdownStartAt: now,
      startAt: now + COUNTDOWN_DURATION,
      endAt: now + COUNTDOWN_DURATION + duration,
      participants: [...participants],
      alive: [...participants],
      eliminationOrder: [],
      finishOrder: [],
      progress: {},
      winnerId: null,
    });
  }

  returnToLobby() {
    if (this.state.status === "LOBBY") return;
    this.commit({ status: "LOBBY", participants: [], alive: [], eliminationOrder: [], finishOrder: [], progress: {}, winnerId: null });
  }

  handleEvent(evt: ClientEvent, now: number) {
    switch (evt.type) {
      case "fall":
        if (isEliminationMode(this.state.mode)) this.eliminate(evt.playerId, now);
        break;
      case "checkpoint":
        this.checkpoint(evt.playerId, evt.index);
        break;
      case "finish":
        this.finishLine(evt.playerId, now);
        break;
    }
  }

  private eliminate(playerId: string, now: number) {
    const s = this.state;
    if (s.status !== "PLAYING" && s.status !== "COUNTDOWN") return;
    if (!s.alive.includes(playerId)) return;
    const alive = s.alive.filter((id) => id !== playerId);
    this.commit({ alive, eliminationOrder: [...s.eliminationOrder, playerId] });
    this.checkFinish(now);
  }

  private checkpoint(playerId: string, index: number) {
    const s = this.state;
    if (s.status !== "PLAYING" || !s.participants.includes(playerId)) return;
    if ((s.progress[playerId] ?? -1) >= index) return;
    this.commit({ progress: { ...s.progress, [playerId]: index } });
  }

  private finishLine(playerId: string, now: number) {
    const s = this.state;
    if (s.status !== "PLAYING" || s.mode !== "RACE") return;
    if (!s.alive.includes(playerId) || s.finishOrder.includes(playerId)) return;
    const finishOrder = [...s.finishOrder, playerId];
    const patch: Partial<GameState> = { finishOrder, progress: { ...s.progress, [playerId]: 999 } };
    if (finishOrder.length === 1) patch.endAt = Math.min(s.endAt, now + RACE_FINISH_GRACE);
    this.commit(patch);
    this.checkFinish(now);
  }

  private checkFinish(now: number) {
    const s = this.state;
    if (s.status !== "PLAYING") return;
    const total = s.participants.length;
    if (s.mode === "RACE") {
      if (s.finishOrder.length > 0 && s.finishOrder.length >= s.alive.length) this.finish(s.finishOrder[0], now);
      return;
    }
    if (total >= 2 && s.alive.length <= 1) {
      this.finish(s.alive[0] ?? null, now);
    } else if (total === 1 && s.alive.length === 0) {
      this.finish(null, now);
    }
  }

  private finish(winnerId: string | null, now: number) {
    this.commit({ status: "FINISHED", winnerId, endAt: now });
  }

  /**
   * Advance time-driven transitions. `presentIds` lets the authority drop
   * players who disconnected mid-round.
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
    if (this.state.status === "PLAYING" && now >= roundEndAt(this.state)) {
      const st = this.state;
      if (st.mode === "RACE") this.finish(st.finishOrder[0] ?? null, now);
      else this.finish(st.alive.length === 1 ? st.alive[0] : null, now);
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

/** Ranking best → worst for the result screen. */
export function computeRanking(state: GameState): string[] {
  const ranking: string[] = [];
  if (state.mode === "RACE") {
    for (const id of state.finishOrder) ranking.push(id);
    const rest = state.participants
      .filter((id) => !ranking.includes(id))
      .sort((a, b) => (state.progress[b] ?? -1) - (state.progress[a] ?? -1));
    for (const id of rest) ranking.push(id);
    return ranking;
  }
  if (state.winnerId) ranking.push(state.winnerId);
  for (const id of state.alive) if (!ranking.includes(id)) ranking.push(id);
  for (let i = state.eliminationOrder.length - 1; i >= 0; i--) {
    const id = state.eliminationOrder[i];
    if (!ranking.includes(id)) ranking.push(id);
  }
  return ranking;
}

export function isSuddenDeath(state: GameState, hostNow: number): boolean {
  return state.status === "PLAYING" && state.mode === "SUMO" && hostNow >= state.endAt;
}
