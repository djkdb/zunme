/**
 * Adaptive render quality. Levels: 2 = full (post-fx, soft 2k shadows, full
 * particles), 1 = lean (dpr 1, 1k shadows, no post-fx), 0 = potato (no shadows,
 * half the particles, no trails). The frame-time monitor steps down when a
 * device can't hold ~45 fps and back up when it has headroom; the last level is
 * remembered so a weak phone starts lean next time.
 */
import { create } from "zustand";

export type QualityLevel = 0 | 1 | 2;

const KEY = "dropzone:quality";

function load(): QualityLevel {
  if (typeof window === "undefined") return 2;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return 2;
    const v = Number(raw);
    return v === 0 || v === 1 ? v : 2;
  } catch {
    return 2;
  }
}

interface QualityStore {
  level: QualityLevel;
  /** true once the user pinned a level from the settings (auto stops adjusting) */
  pinned: boolean;
  setLevel(level: QualityLevel, pinned?: boolean): void;
}

export const useQualityStore = create<QualityStore>((set) => ({
  level: load(),
  pinned: false,
  setLevel(level, pinned = false) {
    set({ level, pinned });
    try {
      localStorage.setItem(KEY, String(level));
    } catch {
      /* ignore */
    }
  },
}));

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  const w = window as unknown as { __dropzone?: Record<string, unknown> };
  w.__dropzone = { ...(w.__dropzone ?? {}), quality: useQualityStore };
}

export function qualityLevel(): QualityLevel {
  return useQualityStore.getState().level;
}

/** Particle count multiplier for the current level. */
export function particleScale(): number {
  const l = qualityLevel();
  return l === 0 ? 0.45 : l === 1 ? 0.75 : 1;
}

export const QUALITY_LABELS: Record<QualityLevel, string> = { 0: "가볍게", 1: "보통", 2: "최고" };
