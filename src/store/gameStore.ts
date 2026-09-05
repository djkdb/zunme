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
import type { GameState, Player, PlayerPresence } from "@/types";

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
  /** Local overlay: user pressed "return to lobby" while the room is still FINISHED. */
  viewingLobby: boolean;
  lastElimination: EliminationNotice | null;
  eliminationSeq: number;
  muted: boolean;

  join(roomCode: string, nickname?: string): Promise<void>;
  leave(): void;
  setNickname(nickname: string): void;
  startGame(): void;
  playAgain(): void;
  returnToLobby(): void;
  reportFall(): void;
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
  viewingLobby: false,
  lastElimination: null,
  eliminationSeq: 0,
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
        set({ presences: players, hostId });
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
        set(patch);
      },
      onEvent: () => {
        /* impacts etc. are handled locally via the effects bus */
      },
      onError: (message) => set({ error: message }),
    });

    try {
      await client.connect();
      set({ client, connected: true, connecting: false, offline: client.offline, state: client.currentState });
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
      viewingLobby: false,
      lastElimination: null,
    });
  },

  setNickname(nickname) {
    saveNickname(nickname);
    set({ nickname });
    get().client?.updateNickname(nickname);
  },

  startGame() {
    get().client?.startGame();
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
    client?.sendEvent({ type: "fall", playerId: localId, at: Date.now() });
  },

  setMuted(muted) {
    set({ muted });
  },
}));

// ── Selectors ────────────────────────────────────────────────────────

export function toPlayers(presences: PlayerPresence[], hostId: string | null, state: GameState): Player[] {
  return presences.map((p) => ({
    ...p,
    color: PLAYER_COLORS[p.colorIndex % PLAYER_COLORS.length].name,
    colorHex: PLAYER_COLORS[p.colorIndex % PLAYER_COLORS.length].hex,
    alive: state.status === "LOBBY" ? true : state.alive.includes(p.id),
    isHost: p.id === hostId,
  }));
}

export const selectPlayers = (s: GameStore) => toPlayers(s.presences, s.hostId, s.state);
export const selectIsHost = (s: GameStore) => s.hostId === s.localId;
export const selectLocalAlive = (s: GameStore) => s.state.alive.includes(s.localId);
export const selectIsParticipant = (s: GameStore) => s.state.participants.includes(s.localId);
