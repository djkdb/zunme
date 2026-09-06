"use client";

import { useEffect } from "react";
import { hasFinishLine, isScoreMode, isSuddenDeath } from "@/game/authority";
import type { GameMode } from "@/types";
import { music, type MusicTrack } from "@/game/music";
import { useHostClock } from "@/hooks/useHostClock";
import { useGameStore } from "@/store/gameStore";

const TRACKS: Record<GameMode, MusicTrack> = {
  SUMO: "SUMO",
  RACE: "RACE",
  MELTDOWN: "MELTDOWN",
  GOGUN: "GOGUN",
  BOSS: "SUMO",
  TAG: "MELTDOWN",
  BOMB: "SUMO",
  HILL: "SUMO",
  COIN: "RACE",
  COLOR: "MELTDOWN",
  WALLS: "RACE",
  TIPTOE: "GOGUN",
  TOWER: "MELTDOWN",
  SPIN: "SUMO",
  CROWN: "RACE",
};
function trackFor(mode: GameMode): MusicTrack {
  return TRACKS[mode];
}

/** Chooses the background track from the current screen/state and drives tension. */
export function MusicDirector({ screen }: { screen: "menu" | "room" }) {
  const status = useGameStore((s) => s.state.status);
  const mode = useGameStore((s) => s.state.mode);
  const state = useGameStore((s) => s.state);
  const now = useHostClock(500);

  useEffect(() => {
    let track: MusicTrack;
    if (screen === "menu") track = "menu";
    else if (status === "LOBBY") track = "lobby";
    else if (status === "FINISHED") track = "result";
    else track = trackFor(mode);
    music.play(track);
  }, [screen, status, mode]);

  useEffect(() => {
    if (status !== "PLAYING") {
      music.setTension(1);
      return;
    }
    const hurry = state.finishOrder.length > 0 && hasFinishLine(mode);
    const final2 = state.alive.length === 2 && state.participants.length > 2 && !hasFinishLine(mode) && !isScoreMode(mode);
    const sudden = isSuddenDeath(state, now);
    music.setTension(sudden || hurry ? 1.15 : final2 ? 1.08 : 1);
  }, [status, state, mode, now]);

  useEffect(() => () => music.stop(), []);
  return null;
}
