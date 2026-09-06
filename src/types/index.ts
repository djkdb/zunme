import type { ModifierId } from "@/game/modifiers";
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
  /** lobby ready check */
  ready?: boolean;
}

export interface Player extends PlayerPresence {
  cosmetics: Cosmetics;
  color: PlayerColorName;
  colorHex: string;
  alive: boolean;
  isHost: boolean;
}

/** One finished round of a series (appended once per round, keyed by round number). */
export interface SeriesRoundResult {
  round: number;
  mode: GameMode;
  ranking: string[];
  winnerId: string | null;
  points: Record<string, number>;
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
  /** knock-outs credited per player (someone they hit fell within a few seconds) */
  knockouts: Record<string, number>;
  /** falls per player (eliminations and respawns alike) */
  falls: Record<string, number>;
  /** host time each eliminated player went out (survival time on the result screen) */
  outAt: Record<string, number>;
  /** rotate modes every round */
  partyMix: boolean;
  /** roll a random game modifier every round */
  modifiersOn: boolean;
  /** the twist applied to the current round ("NONE" for a plain round) */
  modifier: ModifierId;
  /**
   * Series points per player (1st 3 / 2nd 2 / 3rd 1) in a series, or round wins
   * in single-round play. Reset when returning to the lobby.
   */
  series: Record<string, number>;
  /** rounds per series (1 = single rounds) */
  seriesTotal: number;
  /** seed the mode plan was drawn from (same plan on every host) */
  seriesSeed: number;
  /** planned modes, one per round */
  seriesModes: GameMode[];
  /** 1-based round within the series, 0 = no series running */
  seriesRound: number;
  seriesRounds: SeriesRoundResult[];
  seriesChampion: string | null;
  /** host time the next series round auto-starts (0 = none scheduled) */
  nextAt: number;
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
  | { type: "fall"; playerId: string; at: number; by?: string | null }
  /** a fall in a respawn mode: counted, not eliminated */
  | { type: "slip"; playerId: string; by?: string | null }
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
