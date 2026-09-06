/**
 * Emotes: a tiny event-based system. One broadcast per press (throttled),
 * no per-frame traffic; every client shows the bubble above that player's
 * head for a couple of seconds.
 */
import { sound } from "@/game/audio";
import { useGameStore } from "@/store/gameStore";

export const EMOTES = ["👋", "😂", "😡", "😭", "👍", "💀", "🔥", "🏆"] as const;
export const EMOTE_DURATION_MS = 2200;
const EMOTE_THROTTLE_MS = 600;

export interface ActiveEmote {
  e: number;
  since: number;
}

/** player id → currently shown emote (read by the scene every frame) */
export const activeEmotes = new Map<string, ActiveEmote>();
let lastSentAt = 0;

export function showEmote(playerId: string, e: number) {
  if (!Number.isInteger(e) || e < 0 || e >= EMOTES.length) return;
  activeEmotes.set(playerId, { e, since: performance.now() });
  sound.play("emote", { volume: 0.35, throttleMs: 120 });
}

/** Local player pressed an emote: show it here and tell everyone else. */
export function sendEmote(e: number) {
  const now = performance.now();
  if (now - lastSentAt < EMOTE_THROTTLE_MS) return;
  lastSentAt = now;
  const store = useGameStore.getState();
  showEmote(store.localId, e);
  store.client?.broadcastGameplay({ k: "emote", id: store.localId, e });
}

/** Drop expired bubbles (called by the renderer). */
export function pruneEmotes(now: number) {
  activeEmotes.forEach((a, id) => {
    if (now - a.since > EMOTE_DURATION_MS) activeEmotes.delete(id);
  });
}

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  const w = window as unknown as { __dropzone?: Record<string, unknown> };
  w.__dropzone = { ...(w.__dropzone ?? {}), emotes: activeEmotes };
}
