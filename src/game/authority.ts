/**
 * GameAuthority — the rules engine that decides when a round starts, who
 * is eliminated, who finished and who wins. It is deliberately free of
 * React, Three.js and networking so it can run on the host client today
 * and be moved to a real server (edge function / game server) later.
 *
 * Mode families:
 *  - elimination (SUMO, MELTDOWN, BOSS, BOMB, COLOR, WALLS, SPIN): fall = out,
 *    last survivor wins (SUMO has sudden death)
 *  - finish line (RACE, GOGUN, TIPTOE, TOWER): first across wins, others
 *    ranked by finish order then progress
 *  - score (HILL, COIN, CROWN): highest score at time-out wins
 *  - TAG: survivors win at time-out, patient zero wins if everyone turns
 */
import {
  BOMB_PASS_COOLDOWN,
  COUNTDOWN_DURATION,
  CROWN_STEAL_COOLDOWN,
  DEFAULT_MODE,
  GAME_MODES,
  RACE_FINISH_GRACE,
  SCORE_FLUSH_MS,
} from "@/game/config";
import { bombFuse, coinValueById } from "@/game/modes";
import { createRng, randomSeed } from "@/game/random";
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
    bossId: null,
    bossFell: false,
    tagged: [],
    holderId: null,
    holderSince: 0,
    fuseAt: 0,
    scores: {},
    taken: [],
    zone: [],
    team: [],
    partyMix: false,
    series: {},
    winnerId: null,
    hostId,
    version: 1,
  };
}

export const MODE_ROTATION = Object.keys(GAME_MODES) as GameMode[];

/** Wall-clock (host) time at which the round is over no matter what. */
export function roundEndAt(state: GameState): number {
  return state.endAt + (state.mode === "SUMO" ? GAME_MODES.SUMO.suddenDeath : 0);
}

export function hasFinishLine(mode: GameMode): boolean {
  return mode === "RACE" || mode === "GOGUN" || mode === "TIPTOE" || mode === "TOWER";
}

export function isScoreMode(mode: GameMode): boolean {
  return mode === "HILL" || mode === "COIN" || mode === "CROWN";
}

/** A fall knocks the player out of the round (vs. respawning). */
export function isEliminationMode(mode: GameMode): boolean {
  return !hasFinishLine(mode) && !isScoreMode(mode) && mode !== "TAG";
}

export class GameAuthority {
  state: GameState;
  private changed = false;
  private scoreAcc: Record<string, number> = {};
  private lastTickAt = 0;
  private lastFlushAt = 0;
  private explosions = 0;

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

  setPartyMix(on: boolean) {
    if (this.state.partyMix === on) return;
    this.commit({ partyMix: on });
  }

  startCountdown(participants: string[], now: number) {
    if (participants.length === 0) return;
    let mode = this.state.mode;
    if (this.state.partyMix && this.state.round > 0) {
      // Next mode in the rotation that the current head-count can play.
      const i = MODE_ROTATION.indexOf(mode);
      for (let k = 1; k <= MODE_ROTATION.length; k++) {
        const next = MODE_ROTATION[(i + k) % MODE_ROTATION.length];
        if (GAME_MODES[next].minPlayers <= participants.length) {
          mode = next;
          break;
        }
      }
    }
    const seed = randomSeed();
    const rng = createRng(seed);
    const pick = participants[Math.floor(rng() * participants.length)];
    // Boss rotates through the participants by round.
    const bossId = mode === "BOSS" ? participants[this.state.round % participants.length] : null;
    const duration = GAME_MODES[mode].duration;
    const startAt = now + COUNTDOWN_DURATION;
    this.scoreAcc = {};
    this.lastTickAt = now;
    this.lastFlushAt = now;
    this.explosions = 0;
    this.commit({
      status: "COUNTDOWN",
      mode,
      bossId,
      bossFell: false,
      tagged: mode === "TAG" ? [pick] : [],
      holderId: mode === "BOMB" ? pick : null,
      holderSince: startAt,
      fuseAt: mode === "BOMB" ? startAt + bombFuse(0) : 0,
      scores: {},
      taken: [],
      zone: [],
      team: [],
      round: this.state.round + 1,
      seed,
      countdownStartAt: now,
      startAt,
      endAt: startAt + duration,
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
    this.commit({
      status: "LOBBY",
      participants: [],
      alive: [],
      eliminationOrder: [],
      finishOrder: [],
      progress: {},
      winnerId: null,
      bossId: null,
      bossFell: false,
      tagged: [],
      holderId: null,
      holderSince: 0,
      fuseAt: 0,
      scores: {},
      taken: [],
      zone: [],
      team: [],
      series: {},
    });
  }

  handleEvent(evt: ClientEvent, now: number) {
    const mode = this.state.mode;
    switch (evt.type) {
      case "fall":
        if (mode === "TAG") this.infect(evt.playerId, now);
        else if (mode === "CROWN") this.dropCrown(evt.playerId);
        else if (isEliminationMode(mode)) this.eliminate(evt.playerId, now);
        break;
      case "checkpoint":
        this.checkpoint(evt.playerId, evt.index);
        break;
      case "finish":
        this.finishLine(evt.playerId, now);
        break;
      case "tag":
        if (mode === "TAG" && evt.targetId) this.tagContact(evt.playerId, evt.targetId, now);
        else if (mode === "BOMB" && evt.targetId) this.passBomb(evt.playerId, evt.targetId, now);
        else if (mode === "CROWN") this.crownContact(evt.playerId, evt.targetId, now);
        break;
      case "coin":
        this.takeCoin(evt.playerId, evt.coinId);
        break;
      case "zone":
        this.setZone(evt.playerId, evt.on);
        break;
      case "drop":
        if (mode === "CROWN") this.dropCrown(evt.playerId);
        break;
    }
  }

  private playing(): boolean {
    return this.state.status === "PLAYING";
  }

  private eliminate(playerId: string, now: number) {
    const s = this.state;
    if (s.status !== "PLAYING" && s.status !== "COUNTDOWN") return;
    if (!s.alive.includes(playerId)) return;
    const alive = s.alive.filter((id) => id !== playerId);
    const patch: Partial<GameState> = { alive, eliminationOrder: [...s.eliminationOrder, playerId] };
    if (s.zone.includes(playerId)) patch.zone = s.zone.filter((id) => id !== playerId);
    this.commit(patch);
    if (s.mode === "BOMB" && s.holderId === playerId) this.rearmBomb(now);
    this.checkFinish(now);
  }

  // ── TAG ─────────────────────────────────────────────────────────────
  private infect(playerId: string, now: number) {
    const s = this.state;
    if (!this.playing() || !s.alive.includes(playerId) || s.tagged.includes(playerId)) return;
    this.commit({ tagged: [...s.tagged, playerId] });
    this.checkFinish(now);
  }

  private tagContact(a: string, b: string, now: number) {
    const s = this.state;
    if (!this.playing() || !s.alive.includes(a) || !s.alive.includes(b)) return;
    const ta = s.tagged.includes(a);
    const tb = s.tagged.includes(b);
    if (ta && !tb) this.infect(b, now);
    else if (tb && !ta) this.infect(a, now);
  }

  // ── HOT POTATO ──────────────────────────────────────────────────────
  private passBomb(a: string, b: string, now: number) {
    const s = this.state;
    if (!this.playing() || !s.alive.includes(a) || !s.alive.includes(b) || a === b) return;
    if (now - s.holderSince < BOMB_PASS_COOLDOWN) return;
    if (s.holderId === a) this.commit({ holderId: b, holderSince: now });
    else if (s.holderId === b) this.commit({ holderId: a, holderSince: now });
  }

  /** After an explosion (or the holder falling), hand a fresh bomb to a random survivor. */
  private rearmBomb(now: number) {
    const s = this.state;
    if (s.alive.length < 2) {
      this.commit({ holderId: null, fuseAt: 0 });
      return;
    }
    this.explosions++;
    const rng = createRng((s.seed + this.explosions * 977) >>> 0);
    const next = s.alive[Math.floor(rng() * s.alive.length)];
    this.commit({ holderId: next, holderSince: now, fuseAt: now + bombFuse(this.explosions) });
  }

  // ── CROWN RUSH ──────────────────────────────────────────────────────
  private crownContact(a: string, target: string | null, now: number) {
    const s = this.state;
    if (!this.playing() || !s.alive.includes(a)) return;
    if (target === null) {
      if (s.holderId === null) this.commit({ holderId: a, holderSince: now });
      return;
    }
    if (!s.alive.includes(target) || now - s.holderSince < CROWN_STEAL_COOLDOWN) return;
    if (s.holderId === target) this.commit({ holderId: a, holderSince: now });
    else if (s.holderId === a) this.commit({ holderId: target, holderSince: now });
  }

  private dropCrown(playerId: string) {
    if (this.state.holderId === playerId) this.commit({ holderId: null, holderSince: 0 });
  }

  // ── COIN FRENZY / HILL KING ─────────────────────────────────────────
  private takeCoin(playerId: string, coinId: string) {
    const s = this.state;
    if (!this.playing() || s.mode !== "COIN" || !s.alive.includes(playerId) || s.taken.includes(coinId)) return;
    this.commit({ taken: [...s.taken, coinId], scores: { ...s.scores, [playerId]: (s.scores[playerId] ?? 0) + coinValueById(coinId) } });
  }

  private setZone(playerId: string, on: boolean) {
    const s = this.state;
    if (s.mode !== "HILL" || !s.alive.includes(playerId)) return;
    const inZone = s.zone.includes(playerId);
    if (on === inZone) return;
    this.commit({ zone: on ? [...s.zone, playerId] : s.zone.filter((id) => id !== playerId) });
  }

  private checkpoint(playerId: string, index: number) {
    const s = this.state;
    if (s.status !== "PLAYING" || !s.participants.includes(playerId)) return;
    if ((s.progress[playerId] ?? -1) >= index) return;
    this.commit({ progress: { ...s.progress, [playerId]: index } });
  }

  private finishLine(playerId: string, now: number) {
    const s = this.state;
    if (s.status !== "PLAYING" || !hasFinishLine(s.mode)) return;
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
    if (s.mode === "RACE" || s.mode === "TIPTOE") {
      if (s.finishOrder.length > 0 && s.finishOrder.length >= s.alive.length) this.finish(s.finishOrder[0], now);
      return;
    }
    if (s.mode === "GOGUN" || s.mode === "TOWER") {
      // Over when everyone has either finished or fallen.
      const running = s.alive.filter((id) => !s.finishOrder.includes(id));
      if (running.length === 0) this.finish(s.finishOrder[0] ?? null, now);
      return;
    }
    if (s.mode === "BOSS") {
      if (s.bossId && !s.alive.includes(s.bossId)) {
        this.commit({ bossFell: true });
        this.finish(null, now, s.alive.filter((id) => id !== s.bossId)); // hunters win as a team
        return;
      }
      const hunters = s.alive.filter((id) => id !== s.bossId);
      if (total >= 2 && hunters.length === 0) this.finish(s.bossId, now);
      return;
    }
    if (s.mode === "TAG") {
      const survivors = s.alive.filter((id) => !s.tagged.includes(id));
      if (total >= 2 && survivors.length === 0) this.finish(s.tagged[0] ?? null, now);
      return;
    }
    if (isScoreMode(s.mode)) return; // time-out only
    if (total >= 2 && s.alive.length <= 1) {
      this.finish(s.alive[0] ?? null, now);
    } else if (total === 1 && s.alive.length === 0) {
      this.finish(null, now);
    }
  }

  private finish(winnerId: string | null, now: number, team: string[] = []) {
    this.flushScores();
    // Series scoreboard: winner +1, or every member of a winning team +1.
    const series = { ...this.state.series };
    if (winnerId) series[winnerId] = (series[winnerId] ?? 0) + 1;
    else for (const id of team) series[id] = (series[id] ?? 0) + 1;
    this.commit({ status: "FINISHED", winnerId, team, endAt: now, series, zone: [] });
  }

  /** Winner of a score mode at time-out (null when nobody scored). */
  private scoreWinner(): string | null {
    const s = this.state;
    let best: string | null = null;
    let bestScore = 0;
    for (const id of s.participants) {
      const sc = s.scores[id] ?? 0;
      if (sc > bestScore) {
        bestScore = sc;
        best = id;
      }
    }
    return best;
  }

  private flushScores() {
    const s = this.state;
    if (Object.keys(this.scoreAcc).length === 0) return;
    const scores = { ...s.scores };
    for (const id of Object.keys(this.scoreAcc)) scores[id] = (scores[id] ?? 0) + Math.round(this.scoreAcc[id]);
    this.scoreAcc = {};
    this.commit({ scores });
  }

  /**
   * Advance time-driven transitions. `presentIds` lets the authority drop
   * players who disconnected mid-round.
   */
  tick(now: number, presentIds: string[]) {
    const s = this.state;
    const dt = Math.min(500, Math.max(0, now - this.lastTickAt));
    this.lastTickAt = now;
    if (s.status === "COUNTDOWN" && now >= s.startAt) {
      this.commit({ status: "PLAYING" });
    }
    if (this.state.status === "PLAYING" || this.state.status === "COUNTDOWN") {
      const gone = this.state.alive.filter((id) => !presentIds.includes(id));
      for (const id of gone) {
        if (this.state.mode === "CROWN") this.dropCrown(id);
        this.eliminate(id, now);
      }
    }
    if (this.state.status === "PLAYING") {
      const st = this.state;
      // Time-held scores (HILL / CROWN) accumulate here and are flushed in batches.
      if (st.mode === "HILL") for (const id of st.zone) if (st.alive.includes(id)) this.scoreAcc[id] = (this.scoreAcc[id] ?? 0) + dt;
      if (st.mode === "CROWN" && st.holderId && st.alive.includes(st.holderId)) this.scoreAcc[st.holderId] = (this.scoreAcc[st.holderId] ?? 0) + dt;
      if (now - this.lastFlushAt >= SCORE_FLUSH_MS) {
        this.lastFlushAt = now;
        this.flushScores();
      }
      // Bomb explodes: holder out, new bomb (re-armed inside eliminate()).
      if (st.mode === "BOMB" && st.holderId && st.fuseAt > 0 && now >= st.fuseAt) this.eliminate(st.holderId, now);
    }
    if (this.state.status === "PLAYING" && now >= roundEndAt(this.state)) {
      const st = this.state;
      if (hasFinishLine(st.mode)) this.finish(st.finishOrder[0] ?? null, now);
      else if (st.mode === "BOSS") this.finish(st.bossId && st.alive.includes(st.bossId) ? st.bossId : null, now);
      else if (st.mode === "TAG") {
        const survivors = st.alive.filter((id) => !st.tagged.includes(id));
        if (survivors.length === 1) this.finish(survivors[0], now);
        else if (survivors.length > 1) this.finish(null, now, survivors);
        else this.finish(st.tagged[0] ?? null, now);
      } else if (isScoreMode(st.mode)) {
        this.flushScores();
        this.finish(this.scoreWinner(), now);
      } else this.finish(st.alive.length === 1 ? st.alive[0] : null, now);
    }
    if (this.state.status === "LOBBY" && this.state.participants.length > 0) {
      this.commit({ participants: [] });
    }
  }

  /** Convert all host-clock timestamps into a new clock (used on host handover). */
  rebase(offsetMs: number) {
    if (offsetMs === 0) return;
    const s = this.state;
    this.lastTickAt -= offsetMs;
    this.lastFlushAt -= offsetMs;
    this.commit({
      countdownStartAt: s.countdownStartAt ? s.countdownStartAt - offsetMs : 0,
      startAt: s.startAt ? s.startAt - offsetMs : 0,
      endAt: s.endAt ? s.endAt - offsetMs : 0,
      holderSince: s.holderSince ? s.holderSince - offsetMs : 0,
      fuseAt: s.fuseAt ? s.fuseAt - offsetMs : 0,
    });
  }
}

/** Ranking best → worst for the result screen. */
export function computeRanking(state: GameState): string[] {
  const ranking: string[] = [];
  const push = (id: string) => {
    if (!ranking.includes(id)) ranking.push(id);
  };
  if (hasFinishLine(state.mode)) {
    for (const id of state.finishOrder) push(id);
    const rest = state.participants
      .filter((id) => !ranking.includes(id))
      .sort((a, b) => (state.progress[b] ?? -1) - (state.progress[a] ?? -1));
    for (const id of rest) push(id);
    return ranking;
  }
  if (isScoreMode(state.mode)) {
    const byScore = [...state.participants].sort((a, b) => (state.scores[b] ?? 0) - (state.scores[a] ?? 0));
    for (const id of byScore) push(id);
    return ranking;
  }
  if (state.mode === "TAG") {
    const zero = state.tagged[0];
    if (state.winnerId) push(state.winnerId);
    for (const id of state.alive) if (!state.tagged.includes(id)) push(id);
    // later infections rank higher; patient zero goes last unless they won
    for (let i = state.tagged.length - 1; i >= 1; i--) push(state.tagged[i]);
    for (let i = state.eliminationOrder.length - 1; i >= 0; i--) push(state.eliminationOrder[i]);
    if (zero) push(zero);
    for (const id of state.participants) push(id);
    return ranking;
  }
  if (state.mode === "BOSS" && state.bossFell && state.bossId) {
    // hunters who survived first, then fallen hunters, boss last
    for (const id of state.alive) if (id !== state.bossId) push(id);
    for (let i = state.eliminationOrder.length - 1; i >= 0; i--) {
      const id = state.eliminationOrder[i];
      if (id !== state.bossId) push(id);
    }
    push(state.bossId);
    return ranking;
  }
  if (state.winnerId) push(state.winnerId);
  for (const id of state.alive) push(id);
  for (let i = state.eliminationOrder.length - 1; i >= 0; i--) push(state.eliminationOrder[i]);
  return ranking;
}

export function isSuddenDeath(state: GameState, hostNow: number): boolean {
  return state.status === "PLAYING" && state.mode === "SUMO" && hostNow >= state.endAt;
}

/** Label for a team win (no single winner). */
export function teamLabel(mode: GameMode): string {
  return mode === "BOSS" ? "HUNTERS WIN" : mode === "TAG" ? "SURVIVORS WIN" : "TEAM WIN";
}
