"use client";

import { useMemo } from "react";
import { Arena } from "@/components/game/Arena";
import { CameraController } from "@/components/game/CameraController";
import { EffectsDirector } from "@/components/game/EffectsDirector";
import { Environment, Lighting } from "@/components/game/Environment";
import { LocalPlayer, type PlayerRules } from "@/components/game/LocalPlayer";
import { MeltdownArena, meltdownStep } from "@/components/game/MeltdownArena";
import { Meteors } from "@/components/game/Meteors";
import { Obstacles } from "@/components/game/Obstacles";
import { Particles } from "@/components/game/Particles";
import { PhysicsStepper } from "@/components/game/PhysicsStepper";
import { RaceCourse } from "@/components/game/RaceCourse";
import { RemotePlayer } from "@/components/game/RemotePlayer";
import { RooftopCourse, useCourse } from "@/components/game/RooftopCourse";
import {
  GOGUN_COIN_POINTS,
  GOGUN_COIN_RADIUS,
  GOGUN_FALL_Y,
  GOGUN_JUMP,
  GOGUN_LANE_HALF,
  GOGUN_PROGRESS_STEP,
  GOGUN_START_Z,
  GOGUN_WIRE_MIN_AHEAD,
  GOGUN_WIRE_RANGE_AHEAD,
  gogunRuntime,
  gogunSpawn,
  gogunSpeedAt,
  stageAt,
  type Course,
} from "@/game/gogun";
import { burst } from "@/game/effects";
import { sound } from "@/game/audio";
import { spawnPosition } from "@/game/arena";
import { FALL_Y, MELTDOWN_FALL_Y, RACE_FALL_Y, SPAWN_RADIUS } from "@/game/config";
import { meltdownSpawn } from "@/game/meltdown";
import { raceSpawn } from "@/game/race";
import { raceRuntime } from "@/game/sync";
import { selectPlayers, useGameStore } from "@/store/gameStore";
import type { GameMode } from "@/types";

const BASE_RULES: Record<Exclude<GameMode, "GOGUN">, PlayerRules> = {
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
  BOSS: { fallY: FALL_Y, onFall: "eliminate" },
};

function buildGogunRules(course: Course): PlayerRules {
  return {
    fallY: GOGUN_FALL_Y,
    onFall: "eliminate",
    autoRun: {
      speedAt: (d) => gogunSpeedAt(d, course.length),
      jumpForce: GOGUN_JUMP,
      laneHalf: GOGUN_LANE_HALF,
      startZ: GOGUN_START_Z,
      findAnchor: (x, y, z) => {
        let best: Course["anchors"][number] | null = null;
        let bestScore = Infinity;
        for (const a of course.anchors) {
          const ahead = z - a.z;
          if (ahead < GOGUN_WIRE_MIN_AHEAD || ahead > GOGUN_WIRE_RANGE_AHEAD || a.y < y + 1) continue;
          const score = ahead + Math.abs(a.x - x) * 0.5;
          if (score < bestScore) {
            bestScore = score;
            best = a;
          }
        }
        return best;
      },
      onStep: (x, y, z) => {
        const store = useGameStore.getState();
        gogunRuntime.distance = Math.max(gogunRuntime.distance, GOGUN_START_Z - z);
        const stage = stageAt(gogunRuntime.distance);
        if (stage !== gogunRuntime.stage) {
          gogunRuntime.stage = stage;
          sound.play("go", { volume: 0.5 });
          burst({ position: { x, y: y + 1, z }, color: ["#ffd32a", "#ffffff"], count: 16, speed: 3, life: 0.6, size: 0.12 });
        }
        // coins
        for (const c of course.coins) {
          if (gogunRuntime.collected.has(c.index)) continue;
          if (Math.abs(c.z - z) > 1.5) continue;
          if (Math.hypot(c.x - x, c.y - (y + 0.8), c.z - z) < GOGUN_COIN_RADIUS) {
            gogunRuntime.collected.add(c.index);
            gogunRuntime.coins++;
            gogunRuntime.coinPoints += c.gold ? GOGUN_COIN_POINTS.gold : GOGUN_COIN_POINTS.silver;
            sound.play(c.gold ? "go" : "click", { volume: c.gold ? 0.5 : 0.35, throttleMs: 40 });
            burst({ position: { x: c.x, y: c.y, z: c.z }, color: c.gold ? ["#ffd32a", "#fff6c2"] : ["#ffffff", "#dfe6f2"], count: c.gold ? 12 : 5, speed: 2, life: 0.4, size: 0.1, gravity: 2 });
          }
        }
        // progress ticks → host (used for ranking)
        const tick = Math.floor(gogunRuntime.distance / GOGUN_PROGRESS_STEP);
        if (tick > gogunRuntime.lastProgressTick && store.state.status === "PLAYING") {
          gogunRuntime.lastProgressTick = tick;
          store.reportCheckpoint(tick);
        }
        // finish line
        if (!gogunRuntime.finished && z <= course.goalZ - 2 && store.state.status === "PLAYING") {
          gogunRuntime.finished = true;
          store.reportFinish();
          sound.play("win");
          burst({ position: { x, y: y + 1, z }, color: ["#ffd32a", "#2ed573", "#ffffff"], count: 30, speed: 5, life: 1.2, size: 0.14, gravity: 5 });
        }
      },
    },
  };
}

export function spawnFor(mode: GameMode, index: number, count: number): [number, number, number] {
  switch (mode) {
    case "GOGUN":
      return gogunSpawn(index, count);
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
  const bossId = useGameStore((s) => s.state.bossId);
  const course = useCourse();
  const rules = useMemo(() => (mode === "GOGUN" ? buildGogunRules(course) : BASE_RULES[mode]), [mode, course]);

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
      {(mode === "SUMO" || mode === "BOSS") && (
        <>
          <Arena />
          <Obstacles />
          <Meteors />
        </>
      )}
      {mode === "RACE" && <RaceCourse />}
      {mode === "MELTDOWN" && <MeltdownArena />}
      {mode === "GOGUN" && <RooftopCourse course={course} />}
      {visible.map((p) => {
        const idx = Math.max(0, spawnOrder.indexOf(p.id));
        const spawn: [number, number, number] = mode === "BOSS" && bossId === p.id ? [0, 2, 0] : spawnFor(mode, idx, spawnOrder.length);
        return p.id === localId ? (
          <LocalPlayer key={`${p.id}-local-${mode}-${bossId === p.id ? "boss" : "n"}`} id={p.id} nickname={p.nickname} colorHex={p.colorHex} spawn={spawn} showLabel={showLabels} rules={rules} cosmetics={p.cosmetics} boss={mode === "BOSS" && bossId === p.id} />
        ) : (
          <RemotePlayer key={`${p.id}-${mode}-${bossId === p.id ? "boss" : "n"}`} id={p.id} nickname={p.nickname} colorHex={p.colorHex} spawn={spawn} showLabel={showLabels} cosmetics={p.cosmetics} ghost={mode === "GOGUN"} boss={mode === "BOSS" && bossId === p.id} />
        );
      })}
      <Particles max={mobile ? 350 : 600} />
      <CameraController />
      <EffectsDirector />
    </>
  );
}
