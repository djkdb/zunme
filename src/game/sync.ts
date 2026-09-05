/**
 * Peer-to-peer gameplay events that don't need host validation (e.g. a
 * MELTDOWN tile vanishing). Idempotent by design: every client applies
 * them on receipt, the sender applies them immediately.
 */
export type GameplayEvent = { k: "tile"; layer: number; index: number } | { k: "door"; index: number };

type Listener = (evt: GameplayEvent) => void;
const listeners = new Set<Listener>();

export function onGameplayEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitGameplayEvent(evt: GameplayEvent) {
  listeners.forEach((fn) => fn(evt));
}

/** RACE runtime shared between the course sensors and the local player. */
// (exposed on window.__dropzone.race in development, see bottom of file)
export const raceRuntime = {
  lastCheckpoint: -1,
  finished: false,
  respawn: [0, 2, 2] as [number, number, number],
  /** crosswind acceleration currently applied to the local player (m/s²) */
  windX: 0,
  windZ: 0,
  /** vertical launch velocity queued by a jump pad, consumed by the controller */
  launch: 0,
  /** collider handle → surface velocity (conveyor belts) */
  surfaces: new Map<number, [number, number]>(),
  reset() {
    this.lastCheckpoint = -1;
    this.finished = false;
    this.respawn = [0, 2, 2];
    this.windX = 0;
    this.windZ = 0;
    this.launch = 0;
  },
};

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  const w = window as unknown as { __dropzone?: Record<string, unknown> };
  w.__dropzone = { ...(w.__dropzone ?? {}), race: raceRuntime };
}
