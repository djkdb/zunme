"use client";

import { useEffect, useState } from "react";
import { hostNow } from "@/game/clock";

/** Host-synchronised time, re-rendered at a modest interval for HUD timers. */
export function useHostClock(intervalMs = 250): number {
  const [now, setNow] = useState(() => hostNow());
  useEffect(() => {
    const id = setInterval(() => setNow(hostNow()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
