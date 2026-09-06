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

const BASE: Record<"SUMO" | "RACE" | "MELTDOWN" | "BOSS" | "GOGUN", Theme> = {
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

export const THEMES: Record<GameMode, Theme> = {
  ...BASE,
  TAG: { ...BASE.MELTDOWN, skyTop: "#0f2a1e", skyHorizon: "#8fe3a0", skyBottom: "#1f4d3a", fog: "#3f7a58", sun: "#d8ffe0", hemiSky: "#6fd6a0", hemiGround: "#2f5a45", sea: "#1f6a4a", seaDeep: "#0b2a1e", rim: "#2ed573", dust: "#b8ffcf" },
  BOMB: { ...BASE.BOSS, skyTop: "#2a1010", skyHorizon: "#ff9a5c", skyBottom: "#5a2a1a", fog: "#8a4a3a", rim: "#ff7f30", dust: "#ffd0a0" },
  HILL: { ...BASE.SUMO, skyTop: "#3f8fe0", skyHorizon: "#ffe8b0", rim: "#ffd32a" },
  COIN: { ...BASE.SUMO, skyTop: "#6a4fd8", skyHorizon: "#ffd88a", skyBottom: "#c9a0ff", fog: "#ffd88a", rim: "#ffd32a", dust: "#fff0b0" },
  COLOR: { ...BASE.RACE, skyTop: "#2a2a6e", skyHorizon: "#ff9ad5", skyBottom: "#8a6ad8", fog: "#c99ad8", sea: "#5a3a9a", seaDeep: "#241040", rim: "#ff6bcb", dust: "#ffd0f0" },
  WALLS: { ...BASE.RACE, skyTop: "#1f3a5a", skyHorizon: "#a0d8ff", skyBottom: "#5a8ac0", fog: "#8fb8e0", sea: "#3a6ea0", seaDeep: "#1a3050", rim: "#18dcff", dust: "#e0f4ff" },
  TIPTOE: { ...BASE.GOGUN, skyTop: "#101a3a", skyHorizon: "#8fb0ff", skyBottom: "#2a3a6a", fog: "#3a4a7a", sea: "#1a2a5a", seaDeep: "#0a1030", rim: "#8fb0ff", dust: "#d0e0ff" },
  TOWER: { ...BASE.MELTDOWN, skyTop: "#1a0a0a", skyHorizon: "#ff6a3c", skyBottom: "#4a1a10", fog: "#6a2a1a", sea: "#ff5a1c", seaDeep: "#7a1a0a", rim: "#ff7a3c", dust: "#ffb090" },
  SPIN: { ...BASE.SUMO, skyTop: "#18a0c0", skyHorizon: "#c0f8ff", skyBottom: "#5ad0e0", fog: "#b0eefc", sea: "#2fa0c0", seaDeep: "#0f5a80", rim: "#18dcff", dust: "#ffffff" },
  CROWN: { ...BASE.RACE, skyTop: "#4a2a8a", skyHorizon: "#ffd36a", skyBottom: "#b08ad8", fog: "#e0b070", rim: "#ffd32a", dust: "#fff4c0" },
};
