/**
 * Lightweight event bus for "juice": camera shake, particle bursts,
 * slow motion. Rendering code subscribes; gameplay code emits. Nothing
 * here touches React state so it is safe to call every frame.
 */
import type { Vec3 } from "@/types";

export interface BurstRequest {
  position: Vec3;
  color: string | string[];
  count: number;
  speed: number;
  /** seconds */
  life: number;
  size?: number;
  gravity?: number;
  spread?: number;
}

type Listener<T> = (payload: T) => void;

class Emitter<T> {
  private listeners = new Set<Listener<T>>();
  on(fn: Listener<T>): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(payload: T) {
    this.listeners.forEach((fn) => fn(payload));
  }
}

export const shakeEvents = new Emitter<number>();
export const burstEvents = new Emitter<BurstRequest>();
export const focusEvents = new Emitter<{ playerId: string | null; durationMs: number }>();

let timeScale = 1;
let slowmoUntil = 0;

/** Short vibration on phones that support it (hits, falls); silently ignored elsewhere. */
export function haptic(ms: number) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
  } catch {
    /* unsupported */
  }
}

export function shake(strength: number) {
  shakeEvents.emit(strength);
}

export function burst(req: BurstRequest) {
  burstEvents.emit(req);
}

export function slowMotion(scale: number, durationMs: number) {
  timeScale = scale;
  slowmoUntil = performance.now() + durationMs;
}

/** Called once per frame by the physics stepper to relax slow motion. */
export function getTimeScale(): number {
  if (timeScale < 1 && performance.now() > slowmoUntil) {
    timeScale = 1;
  }
  return timeScale;
}

export function resetEffects() {
  timeScale = 1;
  slowmoUntil = 0;
}
