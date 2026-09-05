"use client";

import { sound } from "@/game/audio";
import { useGameStore } from "@/store/gameStore";

export function MuteButton() {
  const muted = useGameStore((s) => s.muted);
  const setMuted = useGameStore((s) => s.setMuted);
  return (
    <button
      aria-label={muted ? "Unmute" : "Mute"}
      className="chip pointer-events-auto flex h-11 w-11 items-center justify-center text-lg text-white"
      onClick={() => {
        sound.unlock();
        const next = !muted;
        sound.setMuted(next);
        setMuted(next);
        if (!next) sound.play("click");
      }}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
