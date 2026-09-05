/**
 * Peer-to-peer gameplay events that don't need host validation (e.g. a
 * MELTDOWN tile vanishing). Idempotent by design: every client applies
 * them on receipt, the sender applies them immediately.
 */
export type GameplayEvent = { k: "tile"; layer: number; index: number };

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
export const raceRuntime = {
  lastCheckpoint: -1,
  finished: false,
  respawn: [0, 2, 2] as [number, number, number],
  reset() {
    this.lastCheckpoint = -1;
    this.finished = false;
    this.respawn = [0, 2, 2];
  },
};
