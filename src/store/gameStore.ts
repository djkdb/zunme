"use client";

/**
 * React-facing store. Holds slowly changing room/game state (player list,
 * phase, rankings). Per-frame data (positions) never goes through here.
 */
import { create } from "zustand";
import { createInitialState } from "@/game/authority";
import { KNOCKOUT_CREDIT_MS, PLAYER_COLORS, SERIES_CHAMPION_BONUS, SERIES_FINISH_BONUS } from "@/game/config";
import { showEmote } from "@/game/emotes";
import { localPose } from "@/game/remote";
import { RoomClient } from "@/lib/multiplayer";
import { loadIdentity, pickFreeColor, saveNickname } from "@/lib/room";
import { sanitizeCosmetics, type Cosmetics } from "@/game/items";
import { computeReward, rewardKey } from "@/game/rewards";
import { useWalletStore } from "@/store/walletStore";
import { currentLevel, useProgressStore } from "@/store/progressStore";
import { gogunRuntime } from "@/game/gogun";
import type { GameMode, GameState, Player, PlayerPresence } from "@/types";

export interface EliminationNotice {
  playerId: string;
  nickname: string;
  colorHex: string;
  at: number;
}

interface GameStore {
  client: RoomClient | null;
  roomCode: string | null;
  localId: string;
  nickname: string;
  connected: boolean;
  connecting: boolean;
  offline: boolean;
  error: string | null;
  presences: PlayerPresence[];
  hostId: string | null;
  state: GameState;
  /** Derived from presences + hostId + state; recomputed on write so selectors stay referentially stable. */
  players: Player[];
  /** Everyone seen in this room (id → last known name/colour), so a series board can still name a player who left. */
  seen: Record<string, { nickname: string; colorHex: string }>;
  /** Local overlay: user pressed "return to lobby" while the room is still FINISHED. */
  viewingLobby: boolean;
  lastElimination: EliminationNotice | null;
  eliminationSeq: number;
  lastFinish: EliminationNotice | null;
  finishSeq: number;
  /** host time when the local player fell / finished this round (0 = not yet) */
  localOutAt: number;
  muted: boolean;
  /** lobby toasts: joins and leaves */
  roomNotices: { key: number; text: string; at: number }[];
  /** socket dropped; the transport is retrying */
  reconnecting: boolean;

  join(roomCode: string, nickname?: string): Promise<void>;
  leave(): void;
  setNickname(nickname: string): void;
  setCosmetics(cosmetics: Cosmetics): void;
  setReady(ready: boolean): void;
  startGame(): void;
  setMode(mode: GameMode): void;
  setPartyMix(on: boolean): void;
  setSeriesTotal(total: number): void;
  playAgain(): void;
  reportFinish(): void;
  reportCheckpoint(index: number): void;
  returnToLobby(): void;
  reportFall(): void;
  /** fell in a respawn mode (stats only) */
  reportSlip(): void;
  /** TAG / BOMB / CROWN: touched another player (or the loose crown when null) */
  reportTag(targetId: string | null): void;
  reportCoin(coinId: string): void;
  reportZone(on: boolean): void;
  reportDrop(): void;
  setMuted(muted: boolean): void;
}

const identity = typeof window !== "undefined" ? loadIdentity() : { id: "server", nickname: "Player" };

/** The client currently connecting (see `join`). */
let pendingJoin: { roomCode: string; client: RoomClient } | null = null;

export const useGameStore = create<GameStore>((set, get) => ({
  client: null,
  roomCode: null,
  localId: identity.id,
  nickname: identity.nickname,
  connected: false,
  connecting: false,
  offline: false,
  error: null,
  presences: [],
  hostId: null,
  state: createInitialState(identity.id),
  players: [],
  seen: {},
  viewingLobby: false,
  lastElimination: null,
  eliminationSeq: 0,
  lastFinish: null,
  finishSeq: 0,
  localOutAt: 0,
  muted: false,
  roomNotices: [],
  reconnecting: false,

  async join(roomCode, nickname) {
    const existing = get().client;
    if (existing && existing.roomCode === roomCode) return;
    // A join is async: a second call for the same room while the first is still connecting
    // (StrictMode re-running the effect, a double tap) must not open a second client — two
    // clients with one identity would both become host and fight over the state.
    if (pendingJoin && pendingJoin.roomCode === roomCode) return;
    pendingJoin?.client.disconnect();
    existing?.disconnect();
    const name = nickname ?? get().nickname;
    const presence: PlayerPresence = {
      id: get().localId,
      nickname: name,
      colorIndex: Math.floor(Math.random() * PLAYER_COLORS.length),
      joinedAt: Date.now(),
      cosmetics: { ...useWalletStore.getState().equipped },
      level: currentLevel(),
    };
    set({ connecting: true, error: null, roomCode, nickname: name, viewingLobby: false, lastElimination: null });

    const client = new RoomClient(roomCode, presence, {
      onPlayers: (players, hostId) => {
        // Resolve colour collisions deterministically: later joiners yield.
        const me = players.find((p) => p.id === presence.id);
        if (me) {
          const clash = players.some((p) => p.id !== me.id && p.colorIndex === me.colorIndex && p.joinedAt <= me.joinedAt);
          if (clash) {
            const taken = players.filter((p) => p.id !== me.id).map((p) => p.colorIndex);
            const next = pickFreeColor(taken);
            if (next !== me.colorIndex) {
              presence.colorIndex = next;
              client.transport.updatePresence({ ...me, colorIndex: next });
            }
          }
        }
        // Join / leave toasts (skip the first sync, which is the room we walked into).
        const before = get().presences;
        const patch: Partial<GameStore> = { presences: players, hostId, players: toPlayers(players, hostId, get().state) };
        const seen = { ...get().seen };
        for (const p of patch.players ?? []) seen[p.id] = { nickname: p.nickname, colorHex: p.colorHex };
        patch.seen = seen;
        if (before.length > 0) {
          const now = performance.now();
          const notices = get().roomNotices.filter((n) => now - n.at < 3500);
          for (const p of players) if (!before.some((b) => b.id === p.id) && p.id !== presence.id) notices.push({ key: now + Math.random(), text: `🎉 ${p.nickname} 님이 들어왔어요`, at: now });
          for (const b of before) if (!players.some((p) => p.id === b.id) && b.id !== presence.id) notices.push({ key: now + Math.random(), text: `👋 ${b.nickname} 님이 나갔어요`, at: now });
          patch.roomNotices = notices.slice(-4);
        }
        set(patch);
      },
      onState: (state) => {
        const prev = get().state;
        const patch: Partial<GameStore> = { state };
        if (state.status === "COUNTDOWN" && prev.status !== "COUNTDOWN") {
          patch.viewingLobby = false;
          patch.lastElimination = null;
        }
        // Ready checks are per round: clear ours as soon as a round is under way (re-checked on
        // every state broadcast, so a missed transition heals itself).
        if (state.status !== "LOBBY" && get().presences.find((p) => p.id === presence.id)?.ready) client.updatePresence({ ready: false });
        if (state.status === "LOBBY") patch.viewingLobby = false;
        if (state.eliminationOrder.length > prev.eliminationOrder.length && state.round === prev.round) {
          const id = state.eliminationOrder[state.eliminationOrder.length - 1];
          const p = get().presences.find((x) => x.id === id);
          patch.lastElimination = {
            playerId: id,
            nickname: p?.nickname ?? "???",
            colorHex: PLAYER_COLORS[p?.colorIndex ?? 0].hex,
            at: performance.now(),
          };
          patch.eliminationSeq = get().eliminationSeq + 1;
        }
        if (state.finishOrder.length > prev.finishOrder.length && state.round === prev.round) {
          const id = state.finishOrder[state.finishOrder.length - 1];
          const p = get().presences.find((x) => x.id === id);
          patch.lastFinish = { playerId: id, nickname: p?.nickname ?? "???", colorHex: PLAYER_COLORS[p?.colorIndex ?? 0].hex, at: performance.now() };
          patch.finishSeq = get().finishSeq + 1;
        }
        if (state.status === "COUNTDOWN" && prev.status !== "COUNTDOWN") {
          patch.lastFinish = null;
          patch.localOutAt = 0;
        }
        if (state.status === "FINISHED" && prev.status !== "FINISHED") {
          const localId = get().localId;
          const reward = computeReward(state, localId);
          if (reward) {
            const outAt = get().localOutAt;
            const roundMs = Math.max(0, state.endAt - state.startAt);
            const finished = state.finishOrder.includes(localId);
            const report = useProgressStore.getState().applyRound(rewardKey(state), {
              mode: state.mode,
              rank: reward.rank,
              participants: state.participants.length,
              won: state.winnerId === localId || state.team.includes(localId),
              finished,
              survivedMs: outAt > state.startAt ? outAt - state.startAt : roundMs,
              checkpoints: state.mode === "RACE" ? Math.max(0, Math.min(5, (state.progress[localId] ?? -1) + 1)) : state.mode === "TIPTOE" || state.mode === "TOWER" ? Math.max(0, Math.min(30, (state.progress[localId] ?? -1) + 1)) : 0,
              roundMs,
              coinPoints: state.mode === "GOGUN" ? gogunRuntime.coinPoints : 0,
              distance: state.mode === "GOGUN" ? gogunRuntime.distance : 0,
              score: state.scores[localId] ?? 0,
              knockouts: state.knockouts[localId] ?? 0,
            });
            if (report) get().client?.updatePresence({ level: currentLevel() });
          }
        }
        // Series decided: champion bonus (claimed once per series seed) and a 🏆 emote on the champion.
        if (state.seriesChampion && state.seriesChampion !== prev.seriesChampion) {
          const localId = get().localId;
          if (state.seriesChampion === localId) useProgressStore.getState().claimBonus(`series:${state.seriesSeed}`, "🏆 시리즈 챔피언", SERIES_CHAMPION_BONUS);
          else if (state.participants.includes(localId)) useProgressStore.getState().claimBonus(`series:${state.seriesSeed}`, "🎉 시리즈 완주", SERIES_FINISH_BONUS);
          showEmote(state.seriesChampion, 7);
        }
        patch.players = toPlayers(get().presences, get().hostId, state);
        set(patch);
      },
      onEvent: () => {
        /* impacts etc. are handled locally via the effects bus */
      },
      onError: (message) => set({ error: message }),
      onConnection: (ok) => set({ reconnecting: !ok }),
    });

    pendingJoin = { roomCode, client };
    try {
      await client.connect();
      if (pendingJoin?.client !== client) {
        // superseded (left the room / joined another while connecting)
        client.disconnect();
        return;
      }
      const state = client.currentState;
      set({ client, connected: true, connecting: false, offline: client.offline, state, players: toPlayers(get().presences, get().hostId, state) });
    } catch (e) {
      client.disconnect();
      set({ connecting: false, connected: false, error: e instanceof Error ? e.message : "Failed to connect" });
    } finally {
      if (pendingJoin?.client === client) pendingJoin = null;
    }
  },

  leave() {
    pendingJoin?.client.disconnect();
    pendingJoin = null;
    get().client?.disconnect();
    set({
      client: null,
      roomCode: null,
      connected: false,
      connecting: false,
      presences: [],
      hostId: null,
      state: createInitialState(get().localId),
      players: [],
      seen: {},
      viewingLobby: false,
      lastElimination: null,
    });
  },

  setNickname(nickname) {
    saveNickname(nickname);
    set({ nickname });
    get().client?.updateNickname(nickname);
  },

  setCosmetics(cosmetics) {
    get().client?.updatePresence({ cosmetics: { ...cosmetics } });
  },

  setReady(ready) {
    get().client?.updatePresence({ ready });
  },

  startGame() {
    get().client?.startGame();
  },

  setMode(mode) {
    get().client?.setMode(mode);
  },

  setPartyMix(on) {
    get().client?.setPartyMix(on);
  },

  setSeriesTotal(total) {
    get().client?.setSeriesTotal(total);
  },

  reportFinish() {
    const { client, localId } = get();
    if (client && !get().localOutAt) set({ localOutAt: client.now() });
    client?.sendEvent({ type: "finish", playerId: localId, at: Date.now() });
  },

  reportCheckpoint(index) {
    const { client, localId } = get();
    client?.sendEvent({ type: "checkpoint", playerId: localId, index });
  },

  playAgain() {
    get().client?.startGame();
  },

  returnToLobby() {
    const { client } = get();
    if (client?.isHost) client.returnToLobby();
    else set({ viewingLobby: true });
  },

  reportFall() {
    const { client, localId } = get();
    if (client && !get().localOutAt) set({ localOutAt: client.now() });
    client?.sendEvent({ type: "fall", playerId: localId, at: Date.now(), by: recentHitter() });
  },

  reportSlip() {
    const { client, localId } = get();
    client?.sendEvent({ type: "slip", playerId: localId, by: recentHitter() });
  },

  reportTag(targetId) {
    const { client, localId } = get();
    client?.sendEvent({ type: "tag", playerId: localId, targetId });
  },

  reportCoin(coinId) {
    const { client, localId } = get();
    client?.sendEvent({ type: "coin", playerId: localId, coinId });
  },

  reportZone(on) {
    const { client, localId } = get();
    client?.sendEvent({ type: "zone", playerId: localId, on });
  },

  reportDrop() {
    const { client, localId } = get();
    client?.sendEvent({ type: "drop", playerId: localId });
  },

  setMuted(muted) {
    set({ muted });
  },
}));

/** Whoever shoved us within the credit window — they get the knock-out. */
function recentHitter(): string | null {
  return localPose.lastHitBy && performance.now() - localPose.lastHitAt < KNOCKOUT_CREDIT_MS ? localPose.lastHitBy : null;
}

// ── Selectors ────────────────────────────────────────────────────────

export function toPlayers(presences: PlayerPresence[], hostId: string | null, state: GameState): Player[] {
  return presences.map((p) => ({
    ...p,
    cosmetics: sanitizeCosmetics(p.cosmetics),
    color: PLAYER_COLORS[p.colorIndex % PLAYER_COLORS.length].name,
    colorHex: PLAYER_COLORS[p.colorIndex % PLAYER_COLORS.length].hex,
    alive: state.status === "LOBBY" ? true : state.alive.includes(p.id),
    isHost: p.id === hostId,
  }));
}

export const selectPlayers = (s: GameStore) => s.players;
export const selectIsHost = (s: GameStore) => s.hostId === s.localId;
export const selectLocalAlive = (s: GameStore) => s.state.alive.includes(s.localId);
export const selectIsParticipant = (s: GameStore) => s.state.participants.includes(s.localId);

// Dev-only inspection hook for e2e tests / console debugging.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  const w = window as unknown as { __dropzone?: Record<string, unknown> };
  w.__dropzone = { ...(w.__dropzone ?? {}), store: useGameStore, progress: useProgressStore, wallet: useWalletStore };
}
