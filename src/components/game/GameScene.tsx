"use client";

import { useEffect, useMemo } from "react";
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
import { CoinField, ColorArena, CrownArena, HillArena, ModeMarkers, SpinCycle, WallRush } from "@/components/game/PartyArenas";
import { TiptoeCourse, tiptoeStep } from "@/components/game/TiptoeCourse";
import { LavaTower } from "@/components/game/LavaTower";
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
import {
  COIN_PICKUP_RADIUS,
  COLOR_FALL_Y,
  CROWN_PICKUP_RADIUS,
  FALL_Y,
  HILL_HEIGHT,
  HILL_RADIUS,
  MELTDOWN_FALL_Y,
  RACE_FALL_Y,
  SPAWN_RADIUS,
  SPIN_FALL_Y,
  TIPTOE_FALL_Y,
  TOWER_PLATFORMS,
  TOWER_STEP_Y,
  WALLS_FALL_Y,
} from "@/game/config";
import { elapsedSinceStart } from "@/game/clock";
import { TIPTOE_GOAL_Z, TOWER_PLATFORM_LIST, TOWER_TOP_Y, buildCoinWaves, colorSpawn, lavaYAt, spinSpawn, tiptoeSpawn, towerSpawn, wallsSpawn, type CoinDef } from "@/game/modes";
import { partyRuntime, reportFinishOnce, reportProgress, ringRespawn } from "@/game/party";
import { raceFinishNow, racePassCheckpoint } from "@/components/game/RaceCourse";
import { RACE_CHECKPOINTS, RACE_FINISH_Z, TRACK_WIDTH } from "@/game/race";
import { localPose } from "@/game/remote";
import { meltdownSpawn } from "@/game/meltdown";
import { raceSpawn } from "@/game/race";
import { raceRuntime } from "@/game/sync";
import { selectPlayers, useGameStore } from "@/store/gameStore";
import type { GameMode } from "@/types";

/** Contact with another player in TAG / BOMB / CROWN — throttled, the host validates. */
function contactTag(otherId: string) {
  const now = performance.now();
  if (now - partyRuntime.lastTagAt < 120) return;
  partyRuntime.lastTagAt = now;
  const store = useGameStore.getState();
  if (store.state.status === "PLAYING") store.reportTag(otherId);
}

const ringRules = (): Pick<PlayerRules, "fallY" | "onFall" | "respawnAt"> => ({ fallY: FALL_Y, onFall: "respawn", respawnAt: () => ringRespawn() });

const BASE_RULES: Record<Exclude<GameMode, "GOGUN" | "COIN">, PlayerRules> = {
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
    // Position fallback for the sensor gates: crossing the line counts even if the
    // intersection event was missed (fast dash, respawn teleport, frame hitch).
    onStep: (x, y, z) => {
      if (y < RACE_FALL_Y + 1) return;
      for (const cp of RACE_CHECKPOINTS) {
        if (cp.index > raceRuntime.lastCheckpoint && z < cp.z - 0.3 && Math.abs(x) <= cp.halfWidth + 1) racePassCheckpoint(cp.index);
      }
      if (!raceRuntime.finished && z < RACE_FINISH_Z - 0.3 && Math.abs(x) <= TRACK_WIDTH / 2 + 1) raceFinishNow();
    },
  },
  MELTDOWN: { fallY: MELTDOWN_FALL_Y, onFall: "eliminate", onGround: meltdownStep },
  BOSS: { fallY: FALL_Y, onFall: "eliminate" },
  TAG: {
    ...ringRules(),
    // falling turns you: the host infects on the fall report, then you respawn as a zombie
    onRespawn: () => useGameStore.getState().reportFall(),
    onContact: contactTag,
    speedScale: () => {
      const s = useGameStore.getState();
      return s.state.tagged.includes(s.localId) ? 1.06 : 1;
    },
  },
  BOMB: {
    fallY: FALL_Y,
    onFall: "eliminate",
    onContact: contactTag,
    speedScale: () => {
      const s = useGameStore.getState();
      return s.state.holderId === s.localId ? 1.12 : 1;
    },
  },
  HILL: {
    ...ringRules(),
    onStep: (x, y, z, grounded) => {
      const on = grounded && Math.hypot(x, z) < HILL_RADIUS && y > HILL_HEIGHT - 0.4;
      const now = performance.now();
      if (on !== partyRuntime.onHill && now - partyRuntime.hillChangedAt > 120) {
        partyRuntime.onHill = on;
        partyRuntime.hillChangedAt = now;
        const store = useGameStore.getState();
        if (store.state.status === "PLAYING") store.reportZone(on);
        if (on) sound.play("click", { volume: 0.4 });
      }
    },
    onRespawn: () => {
      if (partyRuntime.onHill) {
        partyRuntime.onHill = false;
        useGameStore.getState().reportZone(false);
      }
    },
  },
  COLOR: { fallY: COLOR_FALL_Y, onFall: "eliminate" },
  WALLS: { fallY: WALLS_FALL_Y, onFall: "eliminate" },
  TIPTOE: {
    fallY: TIPTOE_FALL_Y,
    onFall: "respawn",
    respawnAt: () => tiptoeSpawn(Math.floor(Math.random() * 4), 4),
    onGround: tiptoeStep,
    onStep: (x, y, z) => {
      // Past the goal line and not falling into the void = finished, airborne or not.
      if (z < TIPTOE_GOAL_Z + 2.4 && y > -1.5) reportFinishOnce(x, y, z);
    },
  },
  TOWER: {
    fallY: -20,
    onFall: "eliminate",
    fallYAt: () => lavaYAt(elapsedSinceStart()) + 0.55,
    onStep: (x, y, z, grounded) => {
      if (grounded) {
        const idx = Math.round(y / TOWER_STEP_Y);
        if (idx > 0) reportProgress(Math.min(TOWER_PLATFORMS - 1, idx));
      }
      // Summit: above the top platform and over it (landing not required).
      const top = TOWER_PLATFORM_LIST[TOWER_PLATFORM_LIST.length - 1];
      if (y > TOWER_TOP_Y - 0.8 && Math.hypot(x - top.x, z - top.z) < top.radius + 0.9) reportFinishOnce(x, y, z);
    },
  },
  SPIN: { fallY: SPIN_FALL_Y, onFall: "eliminate" },
  CROWN: {
    ...ringRules(),
    onContact: contactTag,
    onRespawn: () => {
      const s = useGameStore.getState();
      if (s.state.holderId === s.localId) s.reportDrop();
    },
    onStep: (x, y, z) => {
      const s = useGameStore.getState();
      if (s.state.holderId !== null || s.state.status !== "PLAYING") return;
      if (Math.hypot(x, z) < CROWN_PICKUP_RADIUS && y < 1.5 && performance.now() - partyRuntime.lastTagAt > 300) {
        partyRuntime.lastTagAt = performance.now();
        s.reportTag(null);
        sound.play("checkpoint", { volume: 0.6 });
        burst({ position: { x, y: y + 1.2, z }, color: ["#ffd32a", "#fff6c2", "#ffffff"], count: 18, speed: 3.5, life: 0.7, size: 0.13, gravity: 3 });
      }
    },
    speedScale: () => {
      const s = useGameStore.getState();
      return s.state.holderId === s.localId ? 0.94 : 1;
    },
  },
};

/** COIN FRENZY rules need the seeded wave list to test pickups. */
function buildCoinRules(coins: CoinDef[]): PlayerRules {
  return {
    ...ringRules(),
    onStep: (x, y, z) => {
      const store = useGameStore.getState();
      if (store.state.status !== "PLAYING") return;
      const elapsed = elapsedSinceStart(store.state);
      const taken = store.state.taken;
      for (const c of coins) {
        if (c.at > elapsed || partyRuntime.collected.has(c.id)) continue;
        if (Math.abs(c.x - x) > COIN_PICKUP_RADIUS || Math.abs(c.z - z) > COIN_PICKUP_RADIUS) continue;
        if (Math.hypot(c.x - x, c.z - z) < COIN_PICKUP_RADIUS && y < 2.5 && !taken.includes(c.id)) {
          partyRuntime.collected.add(c.id);
          store.reportCoin(c.id);
          sound.play("coin", { volume: c.gold ? 0.7 : 0.45, throttleMs: 30 });
          burst({ position: { x: c.x, y: 1, z: c.z }, color: c.gold ? ["#ffd32a", "#fff6c2"] : ["#ffffff", "#dfe6f2"], count: c.gold ? 12 : 5, speed: 2, life: 0.4, size: 0.1, gravity: 2 });
        }
      }
    },
  };
}

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
            sound.play("coin", { volume: c.gold ? 0.7 : 0.45, throttleMs: 30 });
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
    case "COLOR":
      return colorSpawn(index, count);
    case "WALLS":
      return wallsSpawn(index, count);
    case "TIPTOE":
      return tiptoeSpawn(index, count);
    case "TOWER":
      return towerSpawn(index, count);
    case "SPIN":
      return spinSpawn(index, count);
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
  const seed = useGameStore((s) => s.state.seed);
  const course = useCourse();
  const round = useGameStore((s) => s.state.round);
  const rules = useMemo(() => (mode === "GOGUN" ? buildGogunRules(course) : mode === "COIN" ? buildCoinRules(buildCoinWaves(seed)) : BASE_RULES[mode]), [mode, course, seed]);
  // Per-round runtime reset for the party modes (respawn points, coin pickups, finish flags).
  useEffect(() => {
    partyRuntime.reset();
    localPose.pendingImpulse = null;
  }, [round, mode]);

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
      {(mode === "TAG" || mode === "BOMB") && (
        <>
          <Arena />
          <Obstacles />
          <ModeMarkers />
        </>
      )}
      {mode === "HILL" && <HillArena />}
      {mode === "COIN" && <CoinField />}
      {mode === "CROWN" && <CrownArena />}
      {mode === "COLOR" && <ColorArena />}
      {mode === "WALLS" && <WallRush />}
      {mode === "SPIN" && <SpinCycle />}
      {mode === "TIPTOE" && <TiptoeCourse />}
      {mode === "TOWER" && <LavaTower />}
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
