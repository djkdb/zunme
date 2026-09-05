"use client";

import { useMemo } from "react";
import { Arena } from "@/components/game/Arena";
import { CameraController } from "@/components/game/CameraController";
import { EffectsDirector } from "@/components/game/EffectsDirector";
import { Environment, Lighting } from "@/components/game/Environment";
import { LocalPlayer } from "@/components/game/LocalPlayer";
import { Obstacles } from "@/components/game/Obstacles";
import { Particles } from "@/components/game/Particles";
import { PhysicsStepper } from "@/components/game/PhysicsStepper";
import { RemotePlayer } from "@/components/game/RemotePlayer";
import { spawnPosition } from "@/game/arena";
import { SPAWN_RADIUS } from "@/game/config";
import { selectPlayers, useGameStore } from "@/store/gameStore";
import { useShallow } from "zustand/react/shallow";

/**
 * Everything inside the Canvas. Which players get a body:
 *  - LOBBY: everyone present (so the lobby is a playground)
 *  - COUNTDOWN/PLAYING: round participants that are still alive
 *  - FINISHED: survivors (the winner takes the spotlight)
 */
export function GameScene({ mobile }: { mobile: boolean }) {
  const players = useGameStore(useShallow(selectPlayers));
  const localId = useGameStore((s) => s.localId);
  const status = useGameStore((s) => s.state.status);
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

  const spawnOrder = status === "LOBBY" ? players.map((p) => p.id) : participants.length ? participants : players.map((p) => p.id);

  return (
    <>
      <Lighting mobile={mobile} />
      <Environment mobile={mobile} />
      <PhysicsStepper />
      <Arena />
      <Obstacles />
      {visible.map((p) => {
        const idx = Math.max(0, spawnOrder.indexOf(p.id));
        const spawn = spawnPosition(idx, spawnOrder.length, SPAWN_RADIUS);
        return p.id === localId ? (
          <LocalPlayer key={`${p.id}-local`} id={p.id} nickname={p.nickname} colorHex={p.colorHex} spawn={spawn} />
        ) : (
          <RemotePlayer key={p.id} id={p.id} nickname={p.nickname} colorHex={p.colorHex} spawn={spawn} />
        );
      })}
      <Particles max={mobile ? 350 : 600} />
      <CameraController />
      <EffectsDirector />
    </>
  );
}
