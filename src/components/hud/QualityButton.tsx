"use client";

import { sound } from "@/game/audio";
import { QUALITY_LABELS, useQualityStore, type QualityLevel } from "@/game/quality";

/** Cycles the render quality (pins it so the auto tuner stops adjusting). */
export function QualityButton() {
  const level = useQualityStore((s) => s.level);
  const setLevel = useQualityStore((s) => s.setLevel);
  return (
    <button
      aria-label="그래픽 품질"
      title={`그래픽: ${QUALITY_LABELS[level]}`}
      className="chip pointer-events-auto flex h-11 items-center gap-1 px-3 text-[11px] font-black tracking-widest text-white"
      onClick={() => {
        sound.play("click");
        setLevel(((level + 2) % 3) as QualityLevel, true);
      }}
    >
      <span>{level === 2 ? "✨" : level === 1 ? "🔅" : "🍃"}</span>
      <span className="hidden sm:inline">{QUALITY_LABELS[level]}</span>
    </button>
  );
}
