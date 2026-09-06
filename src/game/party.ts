/**
 * Runtime shared between the party-mode arenas and the local player
 * controller (not React state; read from the frame loop).
 */
import { SPAWN_RADIUS } from "@/game/config";
import { sound } from "@/game/audio";
import { burst } from "@/game/effects";
import { useGameStore } from "@/store/gameStore";

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

/** Progress ticks for the host (ranking of non-finishers). Monotonic per round. */
export function reportProgress(index: number) {
  if (index <= partyRuntime.lastProgress) return;
  partyRuntime.lastProgress = index;
  const store = useGameStore.getState();
  if (store.state.status === "PLAYING") store.reportCheckpoint(index);
}

/** Cross the finish line once per round — position based, no ground contact needed. */
export function reportFinishOnce(x: number, y: number, z: number) {
  if (partyRuntime.finished) return;
  const store = useGameStore.getState();
  if (store.state.status !== "PLAYING") return;
  partyRuntime.finished = true;
  store.reportFinish();
  sound.play("win");
  burst({ position: { x, y: y + 1, z }, color: ["#ffd32a", "#2ed573", "#ffffff"], count: 30, speed: 5, life: 1.2, size: 0.14, gravity: 5 });
}

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
