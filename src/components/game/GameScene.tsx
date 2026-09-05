"use client";

import { useMemo } from "react";
import { Arena } from "@/components/game/Arena";
import { CameraController } from "@/components/game/CameraController";
import { EffectsDirector } from "@/components/game/EffectsDirector";
import { Environment, Lighting } from "@/components/game/Environment";
import { LocalPlayer, type PlayerRules } from "@/components/game/LocalPlayer";
import { MeltdownArena, meltdownStep } from "@/components/game/MeltdownArena";
import { Obstacles } from "@/components/game/Obstacles";
import { Particles } from "@/components/game/Particles";
import { PhysicsStepper } from "@/components/game/PhysicsStepper";
import { RaceCourse } from "@/components/game/RaceCourse";
import { RemotePlayer } from "@/components/game/RemotePlayer";
import { spawnPosition } from "@/game/arena";
import { FALL_Y, MELTDOWN_FALL_Y, RACE_FALL_Y, SPAWN_RADIUS } from "@/game/config";
import { meltdownSpawn } from "@/game/meltdown";
import { raceSpawn } from "@/game/race";
import { raceRuntime } from "@/game/sync";
import { selectPlayers, useGameStore } from "@/store/gameStore";
import type { GameMode } from "@/types";

const RULES: Record<GameMode, PlayerRules> = {
  SUMO: { fallY: FALL_Y, onFall: "eliminate" },
  RACE: {
    fallY: RACE_FALL_Y,
    onFall: "respawn",
    respawnAt: () => raceRuntime.respawn,
    surfaceVelocity: (handle) => raceRuntime.surfaces.get(handle),
    wind: () => [raceRuntime.windX, raceRuntime.windZ],
    consumeLaunch: () => {
      const v = raceRuntime.launch;
      raceRuntime.launch = 0;
      return v;
    },
  },
  MELTDOWN: { fallY: MELTDOWN_FALL_Y, onFall: "eliminate", onGround: meltdownStep },
};

export function spawnFor(mode: GameMode, index: number, count: number): [number, number, number] {
  switch (mode) {
    case "RACE":
      return raceSpawn(index, count);
    case "MELTDOWN":
      return meltdownSpawn(index, count);
    default:
      return spawnPosition(index, count, SPAWN_RADIUS);
  }
}

/**
 * Everything inside the Canvas. The arena depends on the selected mode
 * (also in the lobby, so switching modes previews the map). Which players
 * get a body:
 *  - LOBBY: everyone present (the lobby is a playground)
 *  - COUNTDOWN/PLAYING: round participants that are still alive
 *  - FINISHED: survivors (the winner takes the spotlight)
 */
export function GameScene({ mobile }: { mobile: boolean }) {
  const players = useGameStore(selectPlayers);
  const localId = useGameStore((s) => s.localId);
  const status = useGameStore((s) => s.state.status);
  const mode = useGameStore((s) => s.state.mode);
  const participants = useGameStore((s) => s.state.participants);
  const alive = useGameStore((s) => s.state.alive);

  const visible = useMemo(() => {
    if (status === "LOBBY") return players;
    const order = participants.length ? participants : players.map((p) => p.id);
    return order
      .map((id) => players.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .filter((p) => alive.includes(p.id));
  }, [players, status, participants, alive]);

  // Nametags only while the arena is the focus; panels cover the scene otherwise.
  const showLabels = status === "COUNTDOWN" || status === "PLAYING";
  const spawnOrder = status === "LOBBY" ? players.map((p) => p.id) : participants.length ? participants : players.map((p) => p.id);

  return (
    <>
      <Lighting mobile={mobile} />
      <Environment mobile={mobile} />
      <PhysicsStepper />
      {mode === "SUMO" && (
        <>
          <Arena />
          <Obstacles />
        </>
      )}
      {mode === "RACE" && <RaceCourse />}
      {mode === "MELTDOWN" && <MeltdownArena />}
      {visible.map((p) => {
        const idx = Math.max(0, spawnOrder.indexOf(p.id));
        const spawn = spawnFor(mode, idx, spawnOrder.length);
        return p.id === localId ? (
          <LocalPlayer key={`${p.id}-local-${mode}`} id={p.id} nickname={p.nickname} colorHex={p.colorHex} spawn={spawn} showLabel={showLabels} rules={RULES[mode]} variant={p.colorIndex} />
        ) : (
          <RemotePlayer key={`${p.id}-${mode}`} id={p.id} nickname={p.nickname} colorHex={p.colorHex} spawn={spawn} showLabel={showLabels} variant={p.colorIndex} />
        );
      })}
      <Particles max={mobile ? 350 : 600} />
      <CameraController />
      <EffectsDirector />
    </>
  );
}
