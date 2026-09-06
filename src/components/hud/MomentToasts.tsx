"use client";

import { useEffect, useRef, useState } from "react";
import { liveMoments } from "@/game/moments";
import { sound } from "@/game/audio";
import { useGameStore } from "@/store/gameStore";

interface Toast {
  key: string;
  text: string;
  at: number;
}

const LIFE_MS = 2_600;

/** Live social callouts (data-driven, one per key per round) stacked under the HUD. */
export function MomentToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const fired = useRef<Set<string>>(new Set());
  const round = useGameStore((s) => s.state.round);
  useEffect(() => {
    fired.current.clear();
  }, [round]);
  useEffect(() => {
    const check = () => {
      const s = useGameStore.getState();
      if (s.state.status !== "PLAYING") return;
      const name = (id: string) => s.players.find((p) => p.id === id)?.nickname ?? s.seen[id]?.nickname ?? "???";
      const fresh = liveMoments(s.state, name).filter((m) => !fired.current.has(m.key));
      if (fresh.length === 0) return;
      const now = performance.now();
      for (const m of fresh) fired.current.add(m.key);
      sound.play("emote", { volume: 0.35 });
      setToasts((prev) => [...prev.filter((t) => now - t.at < LIFE_MS), ...fresh.map((m) => ({ key: m.key, text: m.text, at: now }))].slice(-3));
    };
    const unsub = useGameStore.subscribe(check);
    const sweep = setInterval(() => setToasts((prev) => (prev.some((t) => performance.now() - t.at >= LIFE_MS) ? prev.filter((t) => performance.now() - t.at < LIFE_MS) : prev)), 500);
    return () => {
      unsub();
      clearInterval(sweep);
    };
  }, []);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-[112px] z-10 flex -translate-x-1/2 flex-col items-center gap-1 short:top-[86px]">
      {toasts.map((t) => (
        <div key={t.key} className="anim-pop chip max-w-[88vw] truncate border-brand-2/50 px-3 py-1 text-[12px] font-black text-white hud-text">
          {t.text}
        </div>
      ))}
    </div>
  );
}
