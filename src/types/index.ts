import type { PlayerColorName } from "@/game/config";
import type { Cosmetics } from "@/game/items";

export type GameMode =
  | "SUMO"
  | "RACE"
  | "MELTDOWN"
  | "GOGUN"
  | "BOSS"
  | "TAG"
  | "BOMB"
  | "HILL"
  | "COIN"
  | "COLOR"
  | "WALLS"
  | "TIPTOE"
  | "TOWER"
  | "SPIN"
  | "CROWN";

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
  /** equipped cosmetics (validated on receipt) */
  cosmetics?: Cosmetics;
  /** progression level (cosmetic) */
  level?: number;
}

export interface Player extends PlayerPresence {
  cosmetics: Cosmetics;
  color: PlayerColorName;
  colorHex: string;
  alive: boolean;
  isHost: boolean;
}

/** Authoritative room state. Owned by the host, mirrored on every client. */
export interface GameState {
  status: RoomStatus;
  mode: GameMode;
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
  /** RACE: ids in the order they crossed the finish line. */
  finishOrder: string[];
  /** RACE: highest checkpoint index reached per player. */
  progress: Record<string, number>;
  /** BOSS: who is the boss this round */
  bossId: string | null;
  /** BOSS: true when the hunters knocked the boss off */
  bossFell: boolean;
  /** TAG: infected players, in infection order (first = patient zero) */
  tagged: string[];
  /** BOMB / CROWN: who holds the bomb / crown */
  holderId: string | null;
  /** host time the current holder received it (pass / steal cooldown) */
  holderSince: number;
  /** BOMB: host time the bomb explodes */
  fuseAt: number;
  /** HILL / CROWN: ms held; COIN: coin points */
  scores: Record<string, number>;
  /** COIN: ids of coins already picked up */
  taken: string[];
  /** HILL: players currently on the hill (client reported) */
  zone: string[];
  /** team winners when there is no single winner (hunters, survivors) */
  team: string[];
  /** rotate modes every round */
  partyMix: boolean;
  /** cumulative wins this session (reset when returning to lobby) */
  series: Record<string, number>;
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
  | { type: "finish"; playerId: string; at: number }
  | { type: "checkpoint"; playerId: string; index: number }
  | { type: "impact"; playerId: string; otherId: string; strength: number }
  /** TAG: touched someone; BOMB: passed the bomb; CROWN: touched the holder (targetId) or picked up the loose crown (null) */
  | { type: "tag"; playerId: string; targetId: string | null }
  | { type: "coin"; playerId: string; coinId: string }
  | { type: "zone"; playerId: string; on: boolean }
  /** CROWN: holder fell off — the crown returns to the centre */
  | { type: "drop"; playerId: string }
  | { type: "requestStart"; playerId: string };

export interface RankingEntry {
  playerId: string;
  rank: number;
  nickname: string;
  colorHex: string;
}
