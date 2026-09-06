"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { useQualityStore, type QualityLevel } from "@/game/quality";

const SAMPLE_MS = 2500;
const DOWN_FPS = 42;
const UP_FPS = 57;
const SETTLE_MS = 6000;

/**
 * Frame-time monitor: averages fps over a window and steps the quality level
 * down when the device struggles (or up when it clearly has headroom). Also
 * applies the level's device-pixel-ratio to the renderer.
 */
export function AdaptiveQuality({ mobile }: { mobile: boolean }) {
  const setDpr = useThree((s) => s.setDpr);
  const level = useQualityStore((s) => s.level);
  const frames = useRef(0);
  const windowStart = useRef(0);
  const lastChange = useRef(0);

  useEffect(() => {
    const max = mobile ? 1.5 : 2;
    setDpr(level === 2 ? [1, max] : level === 1 ? [1, Math.min(1.25, max)] : 1);
  }, [level, mobile, setDpr]);

  useFrame(() => {
    const now = performance.now();
    if (windowStart.current === 0) {
      windowStart.current = now;
      lastChange.current = now;
      return;
    }
    frames.current++;
    const span = now - windowStart.current;
    if (span < SAMPLE_MS) return;
    const fps = (frames.current * 1000) / span;
    frames.current = 0;
    windowStart.current = now;
    if (document.hidden || now - lastChange.current < SETTLE_MS) return;
    const q = useQualityStore.getState();
    if (q.pinned) return;
    if (fps < DOWN_FPS && q.level > 0) {
      q.setLevel((q.level - 1) as QualityLevel);
      lastChange.current = now;
    } else if (fps > UP_FPS && q.level < 2 && now - lastChange.current > SETTLE_MS * 3) {
      q.setLevel((q.level + 1) as QualityLevel);
      lastChange.current = now;
    }
  });
  return null;
}
