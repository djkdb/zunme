/**
 * SKY DASH course definition. The track runs from z = +6 (start) towards
 * -z (finish). Everything is static data so all clients agree without
 * networking; obstacle motion is derived from the round clock.
 */
export interface Platform {
  x: number;
  z: number;
  w: number;
  d: number;
  /** top surface height */
  y?: number;
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
export interface Checkpoint {
  index: number;
  z: number;
  halfWidth: number;
  /** where you respawn after falling past this checkpoint */
  respawn: [number, number, number];
}

export const TRACK_WIDTH = 14;
export const RACE_START_Z = 4;
export const RACE_FINISH_Z = -134;
export const RACE_LENGTH = RACE_START_Z - RACE_FINISH_Z;

export const RACE_PLATFORMS: Platform[] = [
  // Start pad
  { x: 0, z: -4, w: TRACK_WIDTH, d: 20, color: "#f4f1ea" },
  // Section A — spinner alley
  { x: 0, z: -27, w: 12, d: 26, color: "#e6e1d6" },
  // Section B — stepping stones (rows of 3, staggered)
  ...[-46, -52, -58, -64].flatMap((z, row) =>
    [-4.2, 0, 4.2].map((x) => ({ x: x + (row % 2 === 0 ? 1.4 : -1.4), z, w: 3, d: 3, color: row % 2 === 0 ? "#ffd4a8" : "#ffc994" })),
  ),
  // Checkpoint 2 landing
  { x: 0, z: -72, w: 12, d: 8, color: "#e6e1d6" },
  // Section C — sweepers
  { x: 0, z: -92, w: 11, d: 32, color: "#f4f1ea" },
  // Section D — narrow bridge
  { x: 0, z: -120, w: 5, d: 24, color: "#ffd4a8" },
  // Finish pad
  { x: 0, z: -139, w: TRACK_WIDTH, d: 14, color: "#c8f2d0" },
];

export const RACE_SPINNERS: SpinnerDef[] = [
  { x: 0, z: -21, length: 10, speed: 1.1, phase: 0 },
  { x: 0, z: -33, length: 10, speed: -1.35, phase: 1.5 },
  { x: 0, z: -114, length: 7, speed: 1.6, phase: 0.4 },
  { x: 0, z: -126, length: 7, speed: -1.9, phase: 2.2 },
];

export const RACE_SWEEPERS: SweeperDef[] = [
  { x: 0, z: -84, length: 5, travel: 4.5, period: 4200, phase: 0 },
  { x: 0, z: -92, length: 5, travel: 4.5, period: 3600, phase: 0.45 },
  { x: 0, z: -100, length: 5, travel: 4.5, period: 3000, phase: 0.8 },
];

export const RACE_CHECKPOINTS: Checkpoint[] = [
  { index: 0, z: -40, halfWidth: 7, respawn: [0, 2, -38] },
  { index: 1, z: -70, halfWidth: 7, respawn: [0, 2, -70] },
  { index: 2, z: -108, halfWidth: 7, respawn: [0, 2, -107] },
];

export function raceSpawn(index: number, count: number): [number, number, number] {
  const spread = Math.min(TRACK_WIDTH - 3, count * 1.6);
  const x = count === 1 ? 0 : -spread / 2 + (index / (count - 1)) * spread;
  return [x, 2, RACE_START_Z];
}

/** Generic obstacle clocks (ms since GO!) with a short ease-in so nothing clips players at spawn. */
export function spinnerAngleAt(def: SpinnerDef, elapsed: number): number {
  const t = Math.max(0, elapsed - 1500) / 1000;
  return def.phase + def.speed * t * Math.min(1, t / 1.5);
}

export function sweeperXAt(def: SweeperDef, elapsed: number): number {
  const t = Math.max(0, elapsed - 1000);
  const phase = ((t / def.period) + def.phase) * Math.PI * 2;
  return def.x + Math.sin(phase) * def.travel;
}

/** 0..1 how far along the track a z coordinate is. */
export function raceProgress(z: number): number {
  return Math.min(1, Math.max(0, (RACE_START_Z - z) / RACE_LENGTH));
}
