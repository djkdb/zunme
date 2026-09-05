import type { PlayerColorName } from "@/game/config";

export type RoomStatus =
  | "LOBBY"
  | "COUNTDOWN"
  | "PLAYING"
  | "FINISHED";

/** Per-client view state; ELIMINATED is a local overlay on top of PLAYING. */
export type LocalPhase = RoomStatus | "ELIMINATED";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Presence payload shared by every participant of a room channel. */
export interface PlayerPresence {
  id: string;
  nickname: string;
  colorIndex: number;
  joinedAt: number;
}

export interface Player extends PlayerPresence {
  color: PlayerColorName;
  colorHex: string;
  alive: boolean;
  isHost: boolean;
}

/** Authoritative room state. Owned by the host, mirrored on every client. */
export interface GameState {
  status: RoomStatus;
  round: number;
  /** Deterministic seed shared by all clients for obstacle schedules. */
  seed: number;
  /** Wall-clock (host) timestamps in ms. */
  countdownStartAt: number;
  startAt: number;
  endAt: number;
  /** Ordered list of participant ids frozen at countdown. */
  participants: string[];
  alive: string[];
  eliminationOrder: string[];
  winnerId: string | null;
  /** Host id when this state was emitted. */
  hostId: string;
  /** Monotonic version for last-writer-wins. */
  version: number;
}

/** Compact transform snapshot broadcast at NET_TICK_RATE. */
export interface PlayerSnapshot {
  id: string;
  /** host-relative time in ms */
  t: number;
  p: [number, number, number];
  /** yaw in radians */
  r: number;
  v: [number, number, number];
  /** grounded flag */
  g: boolean;
}

export interface Room {
  roomId: string;
  roomCode: string;
  hostId: string;
  status: RoomStatus;
  createdAt: number;
}

export type ClientEvent =
  | { type: "fall"; playerId: string; at: number }
  | { type: "impact"; playerId: string; otherId: string; strength: number }
  | { type: "requestStart"; playerId: string };

export interface RankingEntry {
  playerId: string;
  rank: number;
  nickname: string;
  colorHex: string;
}
