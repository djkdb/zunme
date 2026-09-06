"use client";

import { useEffect, useState } from "react";
import { EMOTES, sendEmote } from "@/game/emotes";
import { sound } from "@/game/audio";
import { useIsMobile } from "@/hooks/useIsMobile";

/**
 * Emote input: keys 1–8 on desktop, a 😀 button that opens a picker on
 * phones. Works in the lobby playground and during rounds.
 */
export function EmoteControls({ placement = "game" }: { placement?: "game" | "lobby" }) {
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const m = /^Digit([1-8])$/.exec(e.code);
      if (m) sendEmote(Number(m[1]) - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // lobby: in the top bar next to LEAVE (never over the panel); game: clear of the joystick / thumb buttons
  const pos = placement === "lobby" ? "left-[124px] top-3" : mobile ? "right-3 top-[76px] flex-row-reverse" : "bottom-6 left-3";
  return (
    <div className={`pointer-events-auto absolute z-[12] flex items-center gap-1.5 safe-pad ${pos}`}>
      <button
        className={`chip flex h-11 w-11 items-center justify-center text-xl active:scale-90 ${open ? "border-brand-2" : ""}`}
        aria-label="이모트"
        onClick={() => {
          sound.play("click");
          setOpen((v) => !v);
        }}
      >
        😀
      </button>
      {open && (
        <div className="anim-pop flex items-center gap-1 rounded-full bg-[#12142b]/75 p-1 backdrop-blur">
          {EMOTES.map((e, i) => (
            <button
              key={e}
              className="flex h-9 w-9 items-center justify-center rounded-full text-lg hover:bg-white/15 active:scale-90"
              title={`${i + 1}`}
              onClick={() => {
                sendEmote(i);
                if (mobile) setOpen(false);
              }}
            >
              {e}
            </button>
          ))}
          {!mobile && <span className="px-1.5 text-[10px] font-black tracking-widest text-white/40">1–8</span>}
        </div>
      )}
    </div>
  );
}
