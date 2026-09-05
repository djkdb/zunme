"use client";

import { useSyncExternalStore } from "react";

export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
}

function subscribeMedia(query: string) {
  return (callback: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener("change", callback);
    window.addEventListener("resize", callback);
    return () => {
      mq.removeEventListener("change", callback);
      window.removeEventListener("resize", callback);
    };
  };
}

const subscribePointer = subscribeMedia("(pointer: coarse)");
const subscribeOrientation = subscribeMedia("(orientation: portrait)");

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribePointer, isTouchDevice, () => false);
}

export function useIsPortrait(): boolean {
  return useSyncExternalStore(
    subscribeOrientation,
    () => window.innerHeight > window.innerWidth,
    () => false,
  );
}
