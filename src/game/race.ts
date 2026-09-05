/**
 * SKY DASH course definition — 12 sections, ~280 m, five checkpoints.
 * The track runs from z = +6 (start) towards -z (finish). Everything is
 * static data so all clients agree without networking; obstacle motion
 * is derived from the round clock, random choices from the round seed.
 */
import { createRng } from "@/game/random";

export interface Platform {
  x: number;
  z: number;
  w: number;
  d: number;
  color?: string;
}
export interface SpinnerDef {
  x: number;
  z: number;
  length: number;
  speed: number; // rad/s, sign = direction
  phase: number;
}
export interface SweeperDef {
  x: number;
  z: number;
  length: number; // along z
  travel: number; // half distance along x
  period: number; // ms
  phase: number; // 0..1
}
export interface PistonDef {
  /** side the piston lives on */
  side: -1 | 1;
  z: number;
  /** x the face reaches when fully extended */
  reach: number;
  period: number;
  phase: number;
}
export interface PendulumDef {
  x: number;
  z: number;
  /** max swing angle in radians */
  amplitude: number;
  period: number;
  phase: number;
}
export interface ConveyorDef {
  x: number;
  z: number;
  w: number;
  d: number;
  /** surface velocity along x (m/s) */
  vx: number;
}
export interface FanDef {
  /** which side the fan sits on; wind blows towards -side */
  side: -1 | 1;
  z: number;
  /** zone depth along z */
  d: number;
  /** wind direction sign along x */
  dir: -1 | 1;
}
export interface Checkpoint {
  index: number;
  z: number;
  halfWidth: number;
  /** where you respawn after falling past this checkpoint */
  respawn: [number, number, number];
}

export const TRACK_WIDTH = 14;
export const RACE_START_Z = 4;
export const RACE_FINISH_Z = -266;
export const RACE_LENGTH = RACE_START_Z - RACE_FINISH_Z;

export const DOOR_WALL_Z = -78;
export const DOOR_COUNT = 4;
export const DOOR_WIDTH = 2.4;
export const CRUMBLE_ORIGIN = { x: 0, z: -134, cols: 4, rows: 12 };
export const JUMP_PAD = { x: 0, z: -167 };
export const FINISH_PAD_Z = -272;

export const RACE_PLATFORMS: Platform[] = [
  // 1. Start pad
  { x: 0, z: -4, w: TRACK_WIDTH, d: 20, color: "#f4f1ea" },
  // 2. Spinner alley
  { x: 0, z: -27, w: 12, d: 26, color: "#e6e1d6" },
  // 3. Stepping stones (5 staggered rows)
  ...[-46, -52, -58, -64, -70].flatMap((z, row) =>
    [-4.2, 0, 4.2].map((x) => ({ x: x + (row % 2 === 0 ? 1.4 : -1.4), z, w: 3, d: 3, color: row % 2 === 0 ? "#ffd4a8" : "#ffc994" })),
  ),
  // 4. Door dash hall (CP1 at its entrance)
  { x: 0, z: -83, w: 12, d: 20, color: "#e6e1d6" },
  // 5. Conveyor cross — belts push you toward the gaps on either side
  { x: 0, z: -104, w: 10, d: 22, color: "#dcd7cb" },
  // 6. Hammer run
  { x: 0, z: -125, w: 8, d: 20, color: "#f4f1ea" },
  // 7. Crumble bridge is made of tiles (see CRUMBLE_ORIGIN); landing pad after it
  { x: 0, z: -156, w: 10, d: 10, color: "#e6e1d6" },
  // 8. Jump pad gap: pad platform, then the far side
  { x: 0, z: -165, w: 8, d: 8, color: "#c8f2d0" },
  { x: 0, z: -181, w: 10, d: 14, color: "#e6e1d6" },
  // 9. Sweeper + piston gauntlet
  { x: 0, z: -206, w: 11, d: 30, color: "#f4f1ea" },
  // 10. Wind bridge
  { x: 0, z: -232, w: 4.5, d: 22, color: "#dcd7cb" },
  // 11. Final spinner bridge
  { x: 0, z: -254, w: 5, d: 22, color: "#ffd4a8" },
  // 12. Finish pad
  { x: 0, z: FINISH_PAD_Z, w: TRACK_WIDTH, d: 14, color: "#c8f2d0" },
];

export const RACE_SPINNERS: SpinnerDef[] = [
  { x: 0, z: -21, length: 10, speed: 1.15, phase: 0 },
  { x: 0, z: -33, length: 10, speed: -1.45, phase: 1.5 },
  { x: 0, z: -246, length: 7, speed: 1.5, phase: 0.4 },
  { x: 0, z: -254, length: 7, speed: -1.8, phase: 2.2 },
  { x: 0, z: -262, length: 7, speed: 2.0, phase: 1.1 },
];

export const RACE_SWEEPERS: SweeperDef[] = [
  { x: 0, z: -196, length: 5, travel: 4.5, period: 4000, phase: 0 },
  { x: 0, z: -204, length: 5, travel: 4.5, period: 3400, phase: 0.45 },
  { x: 0, z: -212, length: 5, travel: 4.5, period: 2800, phase: 0.8 },
];

export const RACE_PISTONS: PistonDef[] = [
  { side: -1, z: -200, reach: 1.5, period: 3200, phase: 0.1 },
  { side: 1, z: -208, reach: -1.5, period: 3200, phase: 0.6 },
  { side: -1, z: -216, reach: 1.5, period: 2600, phase: 0.35 },
];

export const RACE_PENDULUMS: PendulumDef[] = [
  { x: 0, z: -119, amplitude: 0.72, period: 3000, phase: 0 },
  { x: 0, z: -125, amplitude: 0.72, period: 3000, phase: 0.5 },
  { x: 0, z: -131, amplitude: 0.72, period: 3400, phase: 0.25 },
];

export const RACE_CONVEYORS: ConveyorDef[] = [
  { x: 0, z: -97, w: 10, d: 5, vx: 4.5 },
  { x: 0, z: -104, w: 10, d: 5, vx: -4.5 },
  { x: 0, z: -111, w: 10, d: 5, vx: 4.5 },
];

export const RACE_FANS: FanDef[] = [
  { side: 1, z: -226, d: 6, dir: -1 },
  { side: -1, z: -233, d: 6, dir: 1 },
  { side: 1, z: -240, d: 6, dir: -1 },
];

export const RACE_CHECKPOINTS: Checkpoint[] = [
  { index: 0, z: -40, halfWidth: 7, respawn: [0, 2, -38] },
  { index: 1, z: -74, halfWidth: 7, respawn: [0, 2, -75] },
  { index: 2, z: -114, halfWidth: 5, respawn: [0, 2, -116] },
  { index: 3, z: -178, halfWidth: 6, respawn: [0, 2, -180] },
  { index: 4, z: -222, halfWidth: 4, respawn: [0, 2, -222] },
];

export function raceSpawn(index: number, count: number): [number, number, number] {
  const spread = Math.min(TRACK_WIDTH - 3, count * 1.6);
  const x = count === 1 ? 0 : -spread / 2 + (index / (count - 1)) * spread;
  return [x, 2, RACE_START_Z];
}

/** Which of the DOOR_COUNT doors are breakable this round (exactly two). */
export function fakeDoors(seed: number): number[] {
  const rng = createRng(seed ^ 0x9e3779b9);
  const idx = [0, 1, 2, 3];
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, 2).sort();
}

// ── obstacle clocks (ms since GO!), all with a short ease-in ──────────
export function spinnerAngleAt(def: SpinnerDef, elapsed: number): number {
  const t = Math.max(0, elapsed - 1500) / 1000;
  return def.phase + def.speed * t * Math.min(1, t / 1.5);
}

export function sweeperXAt(def: SweeperDef, elapsed: number): number {
  const t = Math.max(0, elapsed - 1000);
  const phase = (t / def.period + def.phase) * Math.PI * 2;
  return def.x + Math.sin(phase) * def.travel;
}

/** Piston: dwell retracted, punch out fast, hold briefly, retract. Returns the face x. */
export function pistonXAt(def: PistonDef, elapsed: number, trackHalf: number): number {
  const rest = def.side * (trackHalf + 3.2);
  if (elapsed <= 0) return rest;
  const t = (((elapsed - 800) / def.period + def.phase) % 1 + 1) % 1;
  let k: number;
  if (t < 0.55) k = 0; // waiting
  else if (t < 0.65) k = (t - 0.55) / 0.1; // punch
  else if (t < 0.8) k = 1; // hold
  else k = 1 - (t - 0.8) / 0.2; // retract
  const eased = k < 1 ? k * k : 1;
  return rest + (def.reach - rest) * eased;
}

export function pendulumAngleAt(def: PendulumDef, elapsed: number): number {
  const t = Math.max(0, elapsed - 1200);
  return Math.sin((t / def.period + def.phase) * Math.PI * 2) * def.amplitude * Math.min(1, t / 1500);
}

/** 0..1 how far along the track a z coordinate is. */
export function raceProgress(z: number): number {
  return Math.min(1, Math.max(0, (RACE_START_Z - z) / RACE_LENGTH));
}
