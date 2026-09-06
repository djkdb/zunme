/**
 * Party-mode layouts and deterministic schedules (COLOR PANIC, WALL RUSH,
 * TIPTOE, LAVA CLIMB, SPIN CYCLE, COIN FRENZY, HILL KING, CROWN RUSH).
 * Everything here is pure and seed-driven so every client agrees.
 */
import {
  BOMB_FUSE_MIN,
  BOMB_FUSE_START,
  BOMB_FUSE_STEP,
  COIN_GOLD_POINTS,
  COIN_WAVES,
  COIN_WAVE_INTERVAL,
  COIN_WAVE_SIZE,
  COLOR_CYCLE_MIN,
  COLOR_CYCLE_START,
  COLOR_CYCLE_STEP,
  COLOR_DROP_MS,
  COLOR_GRID,
  COLOR_WARN_MS,
  SPIN_RADIUS,
  TILE_SIZE,
  TIPTOE_COLS,
  TIPTOE_ROWS,
  TIPTOE_TILE,
  TOWER_LAVA_DELAY,
  TOWER_LAVA_SPEED,
  TOWER_LAVA_START_Y,
  TOWER_PLATFORMS,
  TOWER_STEP_Y,
  WALLS_HALF_X,
  WALLS_HALF_Z,
  WALLS_INTERVAL_MIN,
  WALLS_INTERVAL_START,
  WALLS_SLOTS,
  WALLS_SPEED_MAX,
  WALLS_SPEED_START,
} from "@/game/config";
import { createRng } from "@/game/random";

// ── HOT POTATO ───────────────────────────────────────────────────────
/** Fuse length for the n-th bomb of the round (0-based). */
export function bombFuse(explosions: number): number {
  return Math.max(BOMB_FUSE_MIN, BOMB_FUSE_START - explosions * BOMB_FUSE_STEP);
}

// ── COLOR PANIC ──────────────────────────────────────────────────────
export const COLOR_PALETTE = [
  { name: "빨강", hex: "#ff4757", dark: "#c62f3c" },
  { name: "파랑", hex: "#3d8bff", dark: "#2a63c4" },
  { name: "초록", hex: "#2ed573", dark: "#1f9e53" },
  { name: "노랑", hex: "#ffd32a", dark: "#c9a300" },
] as const;

export interface ColorTile {
  index: number;
  x: number;
  z: number;
}

export const COLOR_TILES: ColorTile[] = (() => {
  const tiles: ColorTile[] = [];
  const half = (COLOR_GRID - 1) / 2;
  let index = 0;
  for (let i = 0; i < COLOR_GRID; i++) for (let j = 0; j < COLOR_GRID; j++) tiles.push({ index: index++, x: (i - half) * TILE_SIZE, z: (j - half) * TILE_SIZE });
  return tiles;
})();

/** Colour index of every tile for a given cycle (re-shuffled each cycle so players must move). */
export function colorPattern(seed: number, cycle: number): Uint8Array {
  const rng = createRng((seed ^ (cycle * 0x9e3779b1)) >>> 0);
  const out = new Uint8Array(COLOR_TILES.length);
  // Balanced-ish: deal colours in blocks of 2x2 so islands are walkable, then jitter.
  for (let i = 0; i < COLOR_TILES.length; i++) {
    const t = COLOR_TILES[i];
    const bi = Math.floor((t.x / TILE_SIZE + 50) / 2);
    const bj = Math.floor((t.z / TILE_SIZE + 50) / 2);
    const blockRng = createRng((seed ^ (cycle * 7919) ^ (bi * 131 + bj * 17)) >>> 0);
    out[i] = rng() < 0.18 ? Math.floor(rng() * 4) : Math.floor(blockRng() * 4);
  }
  return out;
}

export interface ColorPhase {
  cycle: number;
  phase: "roam" | "warn" | "drop";
  /** 0..1 inside the phase */
  progress: number;
  /** colour called for this cycle */
  called: number;
  /** ms until the drop starts (warn) / ends (drop) */
  msLeft: number;
}

function colorCycleLength(cycle: number): number {
  return Math.max(COLOR_CYCLE_MIN, COLOR_CYCLE_START - cycle * COLOR_CYCLE_STEP);
}

export function colorPhaseAt(seed: number, elapsed: number, out: ColorPhase): ColorPhase {
  let t = Math.max(0, elapsed);
  let cycle = 0;
  let len = colorCycleLength(0);
  while (t >= len) {
    t -= len;
    cycle++;
    len = colorCycleLength(cycle);
  }
  const rng = createRng((seed + cycle * 101) >>> 0);
  const called = Math.floor(rng() * 4);
  const roam = len - COLOR_WARN_MS - COLOR_DROP_MS;
  out.cycle = cycle;
  out.called = called;
  if (t < roam) {
    out.phase = "roam";
    out.progress = t / roam;
    out.msLeft = roam - t;
  } else if (t < roam + COLOR_WARN_MS) {
    out.phase = "warn";
    out.progress = (t - roam) / COLOR_WARN_MS;
    out.msLeft = roam + COLOR_WARN_MS - t;
  } else {
    out.phase = "drop";
    out.progress = (t - roam - COLOR_WARN_MS) / COLOR_DROP_MS;
    out.msLeft = len - t;
  }
  return out;
}

export function colorSpawn(index: number, count: number): [number, number, number] {
  const a = (index / Math.max(1, count)) * Math.PI * 2;
  return [Math.cos(a) * 6, 2, Math.sin(a) * 6];
}

// ── WALL RUSH ────────────────────────────────────────────────────────
export interface WallDef {
  index: number;
  startAt: number; // ms after GO! when it appears at z = -HALF_Z - 1
  speed: number; // m/s toward +z
  /** slot mask: true = solid */
  solid: boolean[];
  /** travels the other way (from +z to -z) */
  reverse: boolean;
}

export const WALL_SLOT_WIDTH = (WALLS_HALF_X * 2) / WALLS_SLOTS;
export const WALL_TRAVEL_Z = WALLS_HALF_Z + 2;

export function buildWallSchedule(seed: number): WallDef[] {
  const rng = createRng(seed ^ 0x5157);
  const walls: WallDef[] = [];
  let at = 3000;
  let interval = WALLS_INTERVAL_START;
  let speed = WALLS_SPEED_START;
  for (let i = 0; i < 40; i++) {
    const gaps = i < 4 ? 2 : rng() < 0.65 ? 1 : 2;
    const solid = Array(WALLS_SLOTS).fill(true) as boolean[];
    const open = new Set<number>();
    while (open.size < gaps) open.add(Math.floor(rng() * WALLS_SLOTS));
    for (const s of open) solid[s] = false;
    walls.push({ index: i, startAt: at, speed, solid, reverse: i >= 8 && rng() < 0.35 });
    at += interval;
    interval = Math.max(WALLS_INTERVAL_MIN, interval - 110);
    speed = Math.min(WALLS_SPEED_MAX, speed + 0.22);
  }
  return walls;
}

/** z position of a wall (null when not on the platform). */
export function wallZAt(w: WallDef, elapsed: number): number | null {
  const dt = (elapsed - w.startAt) / 1000;
  if (dt < 0) return null;
  const travelled = dt * w.speed;
  if (travelled > WALL_TRAVEL_Z * 2) return null;
  const z = -WALL_TRAVEL_Z + travelled;
  return w.reverse ? -z : z;
}

export function wallsSpawn(index: number, count: number): [number, number, number] {
  const x = count <= 1 ? 0 : ((index / (count - 1)) * 2 - 1) * (WALLS_HALF_X - 2);
  return [x, 2, index % 2 === 0 ? 2 : -2];
}

// ── TIPTOE ───────────────────────────────────────────────────────────
export interface TiptoeTile {
  index: number;
  row: number;
  col: number;
  x: number;
  z: number;
  safe: boolean;
}

export const TIPTOE_START_Z = 4; // start platform centre
export const TIPTOE_FIRST_ROW_Z = -2;
export const TIPTOE_GOAL_Z = TIPTOE_FIRST_ROW_Z - TIPTOE_ROWS * TIPTOE_TILE - 2.6;

export function buildTiptoe(seed: number): TiptoeTile[] {
  const rng = createRng(seed ^ 0x7170);
  const tiles: TiptoeTile[] = [];
  let col = Math.floor(rng() * TIPTOE_COLS);
  let index = 0;
  for (let r = 0; r < TIPTOE_ROWS; r++) {
    const safe = new Set<number>([col]);
    // occasionally a second safe tile next to the path (a red herring or a shortcut)
    if (rng() < 0.3) {
      const side = col + (rng() < 0.5 ? -1 : 1);
      if (side >= 0 && side < TIPTOE_COLS) safe.add(side);
    }
    for (let c = 0; c < TIPTOE_COLS; c++) {
      tiles.push({ index: index++, row: r, col: c, x: (c - (TIPTOE_COLS - 1) / 2) * TIPTOE_TILE, z: TIPTOE_FIRST_ROW_Z - r * TIPTOE_TILE, safe: safe.has(c) });
    }
    // next row's path column is adjacent (or same) so it stays walkable
    const step = rng() < 0.5 ? -1 : 1;
    const next = col + (rng() < 0.7 ? step : 0);
    col = Math.min(TIPTOE_COLS - 1, Math.max(0, next));
  }
  return tiles;
}

export function tiptoeSpawn(index: number, count: number): [number, number, number] {
  const x = count <= 1 ? 0 : ((index / (count - 1)) * 2 - 1) * 3;
  return [x, 2, TIPTOE_START_Z + (index % 2) * 1.2];
}

// ── LAVA CLIMB ───────────────────────────────────────────────────────
export interface TowerPlatform {
  index: number;
  x: number;
  y: number;
  z: number;
  radius: number;
}

export const TOWER_PLATFORM_LIST: TowerPlatform[] = (() => {
  const out: TowerPlatform[] = [];
  for (let i = 1; i <= TOWER_PLATFORMS; i++) {
    const a = i * 0.62;
    // radius alternates so the gaps widen with height
    const r = 6 + (i % 3 === 0 ? 1.4 : 0) + Math.min(1.2, i * 0.05);
    const size = i === TOWER_PLATFORMS ? 2.6 : Math.max(1.2, 1.9 - i * 0.03);
    out.push({ index: i, x: Math.cos(a) * r, y: i * TOWER_STEP_Y, z: Math.sin(a) * r, radius: size });
  }
  return out;
})();
export const TOWER_TOP_Y = TOWER_PLATFORMS * TOWER_STEP_Y;

export function lavaYAt(elapsed: number): number {
  if (!Number.isFinite(elapsed)) return TOWER_LAVA_START_Y - 4;
  const t = Math.max(0, elapsed - TOWER_LAVA_DELAY) / 1000;
  return TOWER_LAVA_START_Y + t * TOWER_LAVA_SPEED;
}

export function towerSpawn(index: number, count: number): [number, number, number] {
  const a = (index / Math.max(1, count)) * Math.PI * 2;
  return [Math.cos(a) * 2.6, 2, Math.sin(a) * 2.6];
}

// ── SPIN CYCLE ───────────────────────────────────────────────────────
export interface SpinBar {
  height: number;
  length: number;
  /** rad/s at GO!, ramps to x1.9 over the round */
  speed: number;
  delay: number;
  color: string;
  offset: [number, number];
}

export const SPIN_BARS: SpinBar[] = [
  { height: 0.45, length: SPIN_RADIUS * 2 + 1, speed: 1.05, delay: 2500, color: "#ff5a3c", offset: [0, 0] },
  { height: 1.0, length: SPIN_RADIUS * 2 + 1, speed: -0.72, delay: 9000, color: "#a55eea", offset: [0, 0] },
  { height: 0.45, length: 6, speed: 2.1, delay: 20000, color: "#18dcff", offset: [0, 4.2] },
];

export function spinAngleAt(bar: SpinBar, elapsed: number): number {
  if (elapsed < bar.delay) return 0;
  const t = (elapsed - bar.delay) / 1000;
  const ramp = 1 + Math.min(0.9, t / 70);
  return bar.speed * t * ramp;
}

export function spinSpawn(index: number, count: number): [number, number, number] {
  const a = (index / Math.max(1, count)) * Math.PI * 2 + 0.4;
  return [Math.cos(a) * 4.5, 2, Math.sin(a) * 4.5];
}

// ── COIN FRENZY ──────────────────────────────────────────────────────
export interface CoinDef {
  id: string;
  wave: number;
  x: number;
  z: number;
  at: number;
  gold: boolean;
}

export function buildCoinWaves(seed: number): CoinDef[] {
  const rng = createRng(seed ^ 0xc01d);
  const coins: CoinDef[] = [];
  for (let w = 0; w < COIN_WAVES; w++) {
    const at = 1500 + w * COIN_WAVE_INTERVAL;
    // waves cluster around a random spot so players fight over piles
    const ca = rng() * Math.PI * 2;
    const cr = rng() * 5;
    const cx = Math.cos(ca) * cr;
    const cz = Math.sin(ca) * cr;
    for (let i = 0; i < COIN_WAVE_SIZE; i++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * 5.2;
      const x = Math.max(-9.5, Math.min(9.5, cx + Math.cos(a) * r));
      const z = Math.max(-9.5, Math.min(9.5, cz + Math.sin(a) * r));
      coins.push({ id: `${w}:${i}`, wave: w, x, z, at: at + i * 90, gold: i < 2 });
    }
  }
  return coins;
}

export function coinValue(c: CoinDef): number {
  return c.gold ? COIN_GOLD_POINTS : 1;
}

/** Value from the id alone (the host does not build the wave list). Ids are "wave:index"; the first two of a wave are gold. */
export function coinValueById(id: string): number {
  const i = Number(id.split(":")[1]);
  return Number.isFinite(i) && i < 2 ? COIN_GOLD_POINTS : 1;
}
