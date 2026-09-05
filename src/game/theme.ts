/** Per-mode visual themes: sky, fog, light and accent colours. */
import type { GameMode } from "@/types";

export interface Theme {
  skyTop: string;
  skyHorizon: string;
  skyBottom: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  sun: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  sea: string;
  seaDeep: string;
  rim: string;
  dust: string;
}

export const THEMES: Record<GameMode, Theme> = {
  SUMO: {
    skyTop: "#4f9cff",
    skyHorizon: "#ffd9c9",
    skyBottom: "#8fc6ff",
    fog: "#ffd9c9",
    fogNear: 70,
    fogFar: 260,
    sun: "#fff4e0",
    sunIntensity: 2.4,
    hemiSky: "#cfe8ff",
    hemiGround: "#ffd6a5",
    sea: "#5fb0ea",
    seaDeep: "#2f79c7",
    rim: "#ff8c5a",
    dust: "#ffffff",
  },
  RACE: {
    skyTop: "#5a63d8",
    skyHorizon: "#ffb36b",
    skyBottom: "#f6c9a0",
    fog: "#ffc48f",
    fogNear: 90,
    fogFar: 340,
    sun: "#ffd9a0",
    sunIntensity: 2.6,
    hemiSky: "#c9c3ff",
    hemiGround: "#ffb36b",
    sea: "#e39a6a",
    seaDeep: "#9a5a8a",
    rim: "#ffd32a",
    dust: "#ffe0b0",
  },
  MELTDOWN: {
    skyTop: "#2a1d5e",
    skyHorizon: "#ff7a6b",
    skyBottom: "#7a3b7a",
    fog: "#c05c78",
    fogNear: 60,
    fogFar: 220,
    sun: "#ffb090",
    sunIntensity: 2.0,
    hemiSky: "#8f7bd8",
    hemiGround: "#ff8a5c",
    sea: "#ff7a3c",
    seaDeep: "#8a2b2b",
    rim: "#ff5a3c",
    dust: "#ffb090",
  },
  BOSS: {
    skyTop: "#3b1f5e",
    skyHorizon: "#ff6b6b",
    skyBottom: "#7a3b7a",
    fog: "#b04c6a",
    fogNear: 60,
    fogFar: 240,
    sun: "#ffb090",
    sunIntensity: 2.1,
    hemiSky: "#a07bd8",
    hemiGround: "#ff7a5c",
    sea: "#7a3b7a",
    seaDeep: "#2a1040",
    rim: "#ff3b3b",
    dust: "#ffb0b0",
  },
  GOGUN: {
    skyTop: "#0b1030",
    skyHorizon: "#ff9a5c",
    skyBottom: "#2a1a4a",
    fog: "#3a2a5c",
    fogNear: 60,
    fogFar: 240,
    sun: "#ffc27a",
    sunIntensity: 1.6,
    hemiSky: "#5a5aa0",
    hemiGround: "#ff9a5c",
    sea: "#1a2a4a",
    seaDeep: "#0b1030",
    rim: "#ffd32a",
    dust: "#ffe0a0",
  },
};
