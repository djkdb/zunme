/**
 * ROOFTOP RUNNER — an original auto-runner: the runner sprints over night-city
 * rooftops, jumps the gaps and hooks a wire onto anchors to swing across the
 * wide ones, collecting coins on the way.
 *
 * The course is generated from the round seed, so every client builds the
 * same city. Distance is measured along -z from the start.
 */
import { createRng } from "@/game/random";

export interface Building {
  index: number;
  x: number;
  /** centre z */
  z: number;
  w: number;
  d: number;
  /** roof height (top surface y) */
  top: number;
  color: string;
  /** z where the roof starts / ends (for progress + camera) */
  zStart: number;
  zEnd: number;
}
export interface Anchor {
  index: number;
  x: number;
  y: number;
  z: number;
}
export interface Coin {
  index: number;
  x: number;
  y: number;
  z: number;
  gold: boolean;
}
export interface RoofObstacle {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  /** roof top the obstacle sits on */
  top: number;
}
export interface Course {
  buildings: Building[];
  anchors: Anchor[];
  coins: Coin[];
  obstacles: RoofObstacle[];
  goalZ: number;
  length: number;
}

export const GOGUN_START_Z = 6;
export const GOGUN_LANE_HALF = 3; // lateral steering limit around x = 0
export const GOGUN_BASE_SPEED = 7.5;
export const GOGUN_MAX_SPEED = 13;
export const GOGUN_JUMP = 9.6;
export const GOGUN_WIRE_RANGE_AHEAD = 20; // how far ahead an anchor may be
export const GOGUN_WIRE_MIN_AHEAD = 0.5;
export const GOGUN_WIRE_RELEASE_BOOST = 1.12;
export const GOGUN_WIRE_MAX_MS = 1500;
export const GOGUN_COIN_RADIUS = 1.1;
export const GOGUN_FALL_Y = -12;
export const GOGUN_PROGRESS_STEP = 25; // metres per progress tick sent to the host
export const GOGUN_COIN_POINTS = { silver: 2, gold: 10 };
export const GOGUN_JUMP_CUT = 0.72; // tap = shorter hop, hold = full jump (softer than the arena cut)
export const GOGUN_CRASH_MS = 250; // blocked by a wall this long while running = you fall

export const GOGUN_STAGES = 6;
export const GOGUN_STAGE_LENGTH = 100; // metres per stage
/** Building palettes per stage: the city changes character as you go. */
const STAGE_PALETTES: string[][] = [
  ["#3a3f5c", "#2f3450", "#454a6d"], // 1 downtown navy
  ["#3d3555", "#4a3b5c", "#5a3b6c"], // 2 purple district
  ["#2b4a5e", "#35505a", "#1f5a6a"], // 3 harbour teal
  ["#5c3a3a", "#6a3f2f", "#4a2f2f"], // 4 brick quarter
  ["#2a2f4f", "#1c2140", "#3a2f6f"], // 5 midnight
  ["#5a4a1f", "#6a5a2f", "#7a6a3f"], // 6 golden heights
];
export function stageAt(distance: number): number {
  return Math.min(GOGUN_STAGES, Math.floor(Math.max(0, distance) / GOGUN_STAGE_LENGTH) + 1);
}

/** Speed grows with distance covered: harder as the run goes on. */
export function gogunSpeedAt(distance: number, length: number): number {
  const k = Math.min(1, Math.max(0, distance / length));
  const stage = stageAt(distance) - 1; // 0..5
  const stepped = stage / Math.max(1, GOGUN_STAGES - 1);
  return GOGUN_BASE_SPEED + (GOGUN_MAX_SPEED - GOGUN_BASE_SPEED) * (0.6 * stepped + 0.4 * k);
}

/**
 * Horizontal distance a full jump covers at a given speed when landing
 * `rise` metres higher (gravity 22, see GRAVITY in config).
 */
function jumpReach(speed: number, rise = 0): number {
  const g = 22;
  const disc = GOGUN_JUMP * GOGUN_JUMP - 2 * g * Math.max(0, rise);
  if (disc <= 0) return 0;
  const air = (GOGUN_JUMP + Math.sqrt(disc)) / g;
  return speed * air;
}
/** Players never jump from the exact edge, and taps are shorter than holds. */
const SAFE_GAP_RATIO = 0.6;

export function buildCourse(seed: number, targetLength = GOGUN_STAGES * GOGUN_STAGE_LENGTH): Course {
  const rng = createRng(seed ^ 0x6a09e667);
  const buildings: Building[] = [];
  const anchors: Anchor[] = [];
  const coins: Coin[] = [];
  const obstacles: RoofObstacle[] = [];

  let z = GOGUN_START_Z + 4; // start pad front edge
  let top = 0;
  let index = 0;
  // Start pad
  buildings.push({ index: index++, x: 0, z: z - 10, w: 12, d: 20, top: 0, color: "#3a3f5c", zStart: z, zEnd: z - 20 });
  z -= 20;

  let distance = 0;
  while (distance < targetLength) {
    const speed = gogunSpeedAt(distance, targetLength);
    const reach = jumpReach(speed);
    const difficulty = Math.min(1, distance / targetLength);
    // Gap: mostly jumpable, sometimes wire-only (wider than a jump)
    // The first two gaps are always plain, short jumps (tutorial ramp); wire gaps come later.
    const early = buildings.length < 3;
    const wireGap = !early && rng() < 0.28 + difficulty * 0.25;
    // Height step: jumps clear ~2.1 m, so plain gaps may rise at most 0.9 m; swings allow more.
    const rise = wireGap ? 2.4 : early ? 0.3 : 0.9;
    const drop = wireGap ? 3.5 : 2.5;
    const nextTop = Math.max(-1, Math.min(7, top + (rng() < 0.5 ? rng() * rise : -rng() * drop)));
    // Plain gaps stay well inside what a real jump reaches (accounting for the climb).
    const safeReach = jumpReach(speed, nextTop - top) * SAFE_GAP_RATIO;
    let gap = wireGap ? reach * (1.25 + rng() * 0.6) : Math.max(2, 2 + rng() * Math.max(0.5, safeReach - 2));
    if (early) gap = Math.min(gap, 3);
    gap = Math.min(gap, wireGap ? gap : safeReach);
    const w = 6 + rng() * 5;
    const d = 9 + rng() * 12;
    const x = (rng() - 0.5) * 2.5;

    if (wireGap) {
      // Anchor above the middle of the gap, high enough to swing under.
      anchors.push({ index: anchors.length, x: x * 0.5, y: Math.max(top, nextTop) + 7.5 + rng() * 1.5, z: z - gap * 0.55 });
      // Gold coin on the swing arc apex
      coins.push({ index: coins.length, x: x * 0.5, y: Math.max(top, nextTop) + 3.2, z: z - gap * 0.5, gold: true });
    } else {
      // Silver coin arc over the jump
      const n = 3;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        coins.push({ index: coins.length, x: x * 0.5, y: Math.max(top, nextTop) + 1.6 + Math.sin(t * Math.PI) * 1.4, z: z - gap * t, gold: false });
      }
    }

    const zStart = z - gap;
    const zEnd = zStart - d;
    const palette = STAGE_PALETTES[Math.min(STAGE_PALETTES.length - 1, stageAt(distance) - 1)];
    buildings.push({ index: index++, x, z: (zStart + zEnd) / 2, w, d, top: nextTop, color: palette[Math.floor(rng() * palette.length)], zStart, zEnd });

    // Rooftop obstacle to hop (only on long roofs, more often later)
    if (d > 13 && rng() < 0.35 + difficulty * 0.35) {
      obstacles.push({ x: x + (rng() - 0.5) * 2, z: zStart - 4 - rng() * (d - 8), w: 2 + rng() * 1.5, h: 0.6, d: 0.8, top: nextTop });
    }
    // A few coins along the roof
    if (d > 11 && rng() < 0.6) {
      for (let i = 0; i < 3; i++) coins.push({ index: coins.length, x: x + (rng() - 0.5) * 2, y: nextTop + 1.1, z: zStart - 3 - i * 1.6, gold: false });
    }

    top = nextTop;
    z = zEnd;
    distance = GOGUN_START_Z - z;
  }
  // Goal pad
  const goalZ = z - 2;
  buildings.push({ index: index++, x: 0, z: goalZ - 8, w: 14, d: 16, top, color: "#2b4a5e", zStart: goalZ, zEnd: goalZ - 16 });

  return { buildings, anchors, coins, obstacles, goalZ, length: GOGUN_START_Z - goalZ };
}

/** Roof top at a given z (or null over a gap). */
export function roofTopAt(course: Course, z: number): number | null {
  for (const b of course.buildings) if (z <= b.zStart && z >= b.zEnd) return b.top;
  return null;
}

/** Runtime state shared between the controller, the scene and the HUD (mutable, not React state). */
export const gogunRuntime = {
  distance: 0,
  coins: 0,
  coinPoints: 0,
  collected: new Set<number>(),
  wire: { active: false, anchor: -1, x: 0, y: 0, z: 0, length: 0, since: 0 },
  /** an anchor is hookable right now (airborne + in range) → HUD hint */
  anchorInRange: false,
  stage: 1,
  finished: false,
  lastProgressTick: -1,
  reset() {
    this.distance = 0;
    this.coins = 0;
    this.coinPoints = 0;
    this.collected.clear();
    this.wire.active = false;
    this.wire.anchor = -1;
    this.anchorInRange = false;
    this.stage = 1;
    this.finished = false;
    this.lastProgressTick = -1;
  },
};

export function gogunSpawn(index: number, count: number): [number, number, number] {
  const spread = Math.min(8, count * 1.4);
  const x = count === 1 ? 0 : -spread / 2 + (index / (count - 1)) * spread;
  return [x, 2, GOGUN_START_Z];
}

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  const w = window as unknown as { __dropzone?: Record<string, unknown> };
  w.__dropzone = { ...(w.__dropzone ?? {}), gogun: gogunRuntime, buildCourse };
}
