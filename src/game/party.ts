/**
 * Runtime shared between the party-mode arenas and the local player
 * controller (not React state; read from the frame loop).
 */
import { SPAWN_RADIUS } from "@/game/config";

export const partyRuntime = {
  /** respawn point for respawn modes */
  respawn: [0, 2, 0] as [number, number, number],
  /** HILL: local player currently standing on the hill */
  onHill: false,
  hillChangedAt: 0,
  /** COIN: optimistic local pickups (until the host confirms) */
  collected: new Set<string>(),
  /** TIPTOE / TOWER: local finish reported */
  finished: false,
  lastProgress: -1,
  /** CROWN: last time we reported a pickup / contact */
  lastTagAt: 0,
  reset() {
    this.respawn = [0, 2, 0];
    this.onHill = false;
    this.hillChangedAt = 0;
    this.collected.clear();
    this.finished = false;
    this.lastProgress = -1;
    this.lastTagAt = 0;
  },
};

/** COLOR PANIC: what the HUD shows (written by the arena every frame). */
export const colorRuntime = {
  phase: "roam" as "roam" | "warn" | "drop",
  called: 0,
  msLeft: 0,
  cycle: 0,
};

/** Random spot on the spawn ring (respawns after a harmless fall). */
export function ringRespawn(radius = SPAWN_RADIUS - 1): [number, number, number] {
  const a = Math.random() * Math.PI * 2;
  return [Math.cos(a) * radius, 2.5, Math.sin(a) * radius];
}

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  const w = window as unknown as { __dropzone?: Record<string, unknown> };
  w.__dropzone = { ...(w.__dropzone ?? {}), party: partyRuntime, color: colorRuntime };
}
