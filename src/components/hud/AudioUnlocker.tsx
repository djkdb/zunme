"use client";

import { useEffect } from "react";
import { sound } from "@/game/audio";
import { useGameStore } from "@/store/gameStore";

/** Unlocks WebAudio on the first user gesture (browser autoplay policy). */
export function AudioUnlocker() {
  useEffect(() => {
    sound.restoreMutePreference();
    useGameStore.getState().setMuted(sound.muted);
    const unlock = () => {
      sound.unlock();
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);
  return null;
}
