/**
 * Arena layout + deterministic obstacle schedules.
 * Every client derives the exact same tile timings from the round seed, so
 * nothing about obstacles needs to be networked.
 */
import {
  ARENA_RADIUS,
  COLLAPSIBLE_MIN_RADIUS,
  GAME_DURATION,
  SPINNER_SPEED,
  SPINNER_START_DELAY,
  SUDDEN_DEATH_DURATION,
  TILE_COLLAPSE_DURATION,
  TILE_CYCLE_MAX,
  TILE_CYCLE_MIN,
  TILE_FIRST_COLLAPSE_DELAY,
  TILE_SIZE,
  TILE_WARNING_DURATION,
  WALL_PERIOD,
  WALL_TRAVEL,
} from "@/game/config";
import { createRng } from "@/game/random";

export interface Tile {
  index: number;
  x: number;
  z: number;
  radius: number;
  collapsible: boolean;
}

export type TilePhase = "NORMAL" | "WARNING" | "COLLAPSED";

export interface TileState {
  phase: TilePhase;
  /** 0..1 progress within the current phase */
  progress: number;
  /** true once the tile is gone for good (sudden death) */
  permanent: boolean;
}

interface TileEvent {
  warnAt: number;
  collapseAt: number;
  restoreAt: number; // Infinity = permanent
}

export function buildTiles(): Tile[] {
  const tiles: Tile[] = [];
  const n = Math.ceil(ARENA_RADIUS / TILE_SIZE) + 1;
  let index = 0;
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const x = i * TILE_SIZE;
      const z = j * TILE_SIZE;
      const radius = Math.hypot(x, z);
      // Keep tiles whose centre is inside the circle, giving a chunky round island.
      if (radius <= ARENA_RADIUS - TILE_SIZE * 0.35) {
        tiles.push({ index: index++, x, z, radius, collapsible: radius >= COLLAPSIBLE_MIN_RADIUS });
      }
    }
  }
  return tiles;
}

export const TILES = buildTiles();

export type TileSchedule = TileEvent[][];

/** Precompute the collapse timeline for a round. Times are ms since GO!. */
export function buildTileSchedule(seed: number): TileSchedule {
  const rng = createRng(seed);
  const schedule: TileSchedule = TILES.map(() => []);
  const collapsible = TILES.filter((t) => t.collapsible);

  // Only a subset of outer tiles cycle during the main round, so the island
  // never turns into swiss cheese. Sudden death removes the rest.
  const active = collapsible.filter(() => rng() < 0.45);
  for (const tile of active) {
    let t = TILE_FIRST_COLLAPSE_DELAY + rng() * TILE_CYCLE_MAX;
    const events: TileEvent[] = [];
    while (t < GAME_DURATION) {
      const warnAt = t;
      const collapseAt = warnAt + TILE_WARNING_DURATION;
      const restoreAt = collapseAt + TILE_COLLAPSE_DURATION;
      events.push({ warnAt, collapseAt, restoreAt });
      t = restoreAt + TILE_CYCLE_MIN + rng() * (TILE_CYCLE_MAX - TILE_CYCLE_MIN);
    }
    schedule[tile.index] = events;
  }

  // Sudden death: outer tiles fall permanently from the rim inwards.
  const order = [...collapsible].sort((a, b) => b.radius - a.radius || rng() - 0.5);
  const window = SUDDEN_DEATH_DURATION * 0.75;
  order.forEach((tile, i) => {
    const warnAt = GAME_DURATION + (i / order.length) * window;
    schedule[tile.index] = schedule[tile.index]
      .filter((e) => e.warnAt < warnAt)
      .map((e) => ({ ...e, restoreAt: Math.min(e.restoreAt, warnAt) }));
    schedule[tile.index].push({ warnAt, collapseAt: warnAt + TILE_WARNING_DURATION, restoreAt: Infinity });
  });
  return schedule;
}

/**
 * Generic cycling schedule for a field of `count` tiles (race crumble
 * bridge): every tile crumbles periodically, staggered, for the whole round.
 */
export function buildCrumbleSchedule(seed: number, count: number, opts: { firstDelay: number; cycleMin: number; cycleMax: number; duration: number }): TileSchedule {
  const rng = createRng(seed ^ 0x51ed270b);
  const schedule: TileSchedule = [];
  for (let i = 0; i < count; i++) {
    const events: TileEvent[] = [];
    let t = opts.firstDelay + rng() * opts.cycleMax;
    while (t < opts.duration) {
      const collapseAt = t + TILE_WARNING_DURATION;
      const restoreAt = collapseAt + TILE_COLLAPSE_DURATION * 0.7;
      events.push({ warnAt: t, collapseAt, restoreAt });
      t = restoreAt + opts.cycleMin + rng() * (opts.cycleMax - opts.cycleMin);
    }
    schedule.push(events);
  }
  return schedule;
}

export function getTileState(events: TileEvent[], elapsed: number, out: TileState): TileState {
  out.phase = "NORMAL";
  out.progress = 0;
  out.permanent = false;
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (elapsed < e.warnAt) continue;
    if (elapsed < e.collapseAt) {
      out.phase = "WARNING";
      out.progress = (elapsed - e.warnAt) / (e.collapseAt - e.warnAt);
    } else if (elapsed < e.restoreAt) {
      out.phase = "COLLAPSED";
      out.permanent = e.restoreAt === Infinity;
      out.progress = out.permanent ? Math.min(1, (elapsed - e.collapseAt) / 1000) : (elapsed - e.collapseAt) / (e.restoreAt - e.collapseAt);
    }
    break;
  }
  return out;
}

/** Obstacle speed multiplier: 1 during the round, ramping up to 2 in sudden death. */
export function obstacleSpeedMultiplier(elapsed: number): number {
  if (elapsed < GAME_DURATION) return 1;
  return 1 + Math.min(1, (elapsed - GAME_DURATION) / 10000);
}

/** Spinner angle in radians for a given elapsed time (ms since GO!). */
export function spinnerAngle(elapsed: number): number {
  const t = Math.max(0, elapsed - SPINNER_START_DELAY) / 1000;
  // Integrate a speed that ramps in sudden death: approximate with piecewise.
  const base = Math.min(t, (GAME_DURATION - SPINNER_START_DELAY) / 1000);
  let angle = base * SPINNER_SPEED;
  const sd = Math.max(0, elapsed - GAME_DURATION) / 1000;
  if (sd > 0) {
    // speed = SPINNER_SPEED * (1 + min(1, sd/10)); integral:
    const ramp = Math.min(sd, 10);
    angle += SPINNER_SPEED * (ramp + (ramp * ramp) / 20) + SPINNER_SPEED * 2 * Math.max(0, sd - 10);
  }
  // Soft ease-in at the start so nobody gets clipped on frame one.
  const ease = Math.min(1, t / 2);
  return angle * ease;
}

/** Moving wall X position for a given elapsed time. */
export function wallPosition(elapsed: number): number {
  const mult = obstacleSpeedMultiplier(elapsed);
  const t = Math.max(0, elapsed - 1500) * mult;
  const phase = ((t % WALL_PERIOD) / WALL_PERIOD) * Math.PI * 2;
  return Math.sin(phase) * WALL_TRAVEL;
}

export function spawnPosition(index: number, count: number, radius: number): [number, number, number] {
  const angle = (index / Math.max(1, count)) * Math.PI * 2 + Math.PI / 4;
  return [Math.cos(angle) * radius, 2, Math.sin(angle) * radius];
}
