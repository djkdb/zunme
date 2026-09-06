"use client";

/**
 * React-facing store. Holds slowly changing room/game state (player list,
 * phase, rankings). Per-frame data (positions) never goes through here.
 */
import { create } from "zustand";
import { createInitialState } from "@/game/authority";
import { PLAYER_COLORS } from "@/game/config";
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
  /** Local overlay: user pressed "return to lobby" while the room is still FINISHED. */
  viewingLobby: boolean;
  lastElimination: EliminationNotice | null;
  eliminationSeq: number;
  lastFinish: EliminationNotice | null;
  finishSeq: number;
  /** host time when the local player fell / finished this round (0 = not yet) */
  localOutAt: number;
  muted: boolean;

  join(roomCode: string, nickname?: string): Promise<void>;
  leave(): void;
  setNickname(nickname: string): void;
  setCosmetics(cosmetics: Cosmetics): void;
  startGame(): void;
  setMode(mode: GameMode): void;
  setPartyMix(on: boolean): void;
  playAgain(): void;
  reportFinish(): void;
  reportCheckpoint(index: number): void;
  returnToLobby(): void;
  reportFall(): void;
  /** TAG / BOMB / CROWN: touched another player (or the loose crown when null) */
  reportTag(targetId: string | null): void;
  reportCoin(coinId: string): void;
  reportZone(on: boolean): void;
  reportDrop(): void;
  setMuted(muted: boolean): void;
}

const identity = typeof window !== "undefined" ? loadIdentity() : { id: "server", nickname: "Player" };

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
  viewingLobby: false,
  lastElimination: null,
  eliminationSeq: 0,
  lastFinish: null,
  finishSeq: 0,
  localOutAt: 0,
  muted: false,

  async join(roomCode, nickname) {
    const existing = get().client;
    if (existing && existing.roomCode === roomCode) return;
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
        set({ presences: players, hostId, players: toPlayers(players, hostId, get().state) });
      },
      onState: (state) => {
        const prev = get().state;
        const patch: Partial<GameStore> = { state };
        if (state.status === "COUNTDOWN" && prev.status !== "COUNTDOWN") {
          patch.viewingLobby = false;
          patch.lastElimination = null;
        }
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
            });
            if (report) get().client?.updatePresence({ level: currentLevel() });
          }
        }
        patch.players = toPlayers(get().presences, get().hostId, state);
        set(patch);
      },
      onEvent: () => {
        /* impacts etc. are handled locally via the effects bus */
      },
      onError: (message) => set({ error: message }),
    });

    try {
      await client.connect();
      const state = client.currentState;
      set({ client, connected: true, connecting: false, offline: client.offline, state, players: toPlayers(get().presences, get().hostId, state) });
    } catch (e) {
      client.disconnect();
      set({ connecting: false, connected: false, error: e instanceof Error ? e.message : "Failed to connect" });
    }
  },

  leave() {
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

  startGame() {
    get().client?.startGame();
  },

  setMode(mode) {
    get().client?.setMode(mode);
  },

  setPartyMix(on) {
    get().client?.setPartyMix(on);
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
    client?.sendEvent({ type: "fall", playerId: localId, at: Date.now() });
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
  w.__dropzone = { ...(w.__dropzone ?? {}), store: useGameStore };
}
