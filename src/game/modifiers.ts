/**
 * Game modifiers: one optional rule twist per round, rolled from the round seed
 * by the host so every client agrees. They scale existing systems (speed, jump,
 * gravity, knockback, size, dash, fog, round length) rather than adding new code
 * paths, so every mode keeps working with any modifier.
 */
import type { GameMode } from "@/types";
import { createRng } from "@/game/random";

export type ModifierId = "NONE" | "MOON" | "TURBO" | "GIANT" | "TINY" | "ICE" | "BOUNCY" | "BLITZ" | "FOG" | "SUPERJUMP" | "DASHMANIA";

export interface ModifierDef {
  id: ModifierId;
  name: string;
  icon: string;
  /** one line shown on the intro card */
  desc: string;
  /** ground speed multiplier */
  speed: number;
  /** jump velocity multiplier */
  jump: number;
  /** gravity multiplier */
  gravity: number;
  /** knockback multiplier (dealt and received) */
  knockback: number;
  /** visual + collider scale of every player */
  scale: number;
  /** dash cooldown multiplier */
  dashCooldown: number;
  /** acceleration multiplier (ICE: sluggish response) */
  accel: number;
  /** per-frame idle friction override (ICE keeps sliding) */
  idleFriction: number | null;
  /** round length multiplier */
  duration: number;
  /** fog distance multiplier (< 1 = thicker) */
  fog: number;
  /** modes where this twist would break the round or be pointless */
  excludes: GameMode[];
}

const BASE: Omit<ModifierDef, "id" | "name" | "icon" | "desc"> = {
  speed: 1,
  jump: 1,
  gravity: 1,
  knockback: 1,
  scale: 1,
  dashCooldown: 1,
  accel: 1,
  idleFriction: null,
  duration: 1,
  fog: 1,
  excludes: [],
};

const RACE_MODES: GameMode[] = ["RACE", "GOGUN", "TIPTOE", "TOWER"];

export const MODIFIERS: Record<ModifierId, ModifierDef> = {
  NONE: { ...BASE, id: "NONE", name: "없음", icon: "", desc: "" },
  MOON: { ...BASE, id: "MOON", name: "저중력", icon: "🌙", desc: "달처럼 둥실둥실. 점프가 오래 떠 있어요", gravity: 0.45, jump: 0.8 },
  TURBO: { ...BASE, id: "TURBO", name: "터보", icon: "⚡", desc: "모두 1.35배 빠르게. 브레이크 조심", speed: 1.35, dashCooldown: 0.8 },
  GIANT: { ...BASE, id: "GIANT", name: "거인", icon: "🦣", desc: "모두 커지고 밀치기가 훨씬 세져요", scale: 1.35, knockback: 1.5, excludes: ["TIPTOE"] },
  TINY: { ...BASE, id: "TINY", name: "콩알", icon: "🐜", desc: "작고 빠르지만 툭 치면 멀리 날아가요", scale: 0.7, speed: 1.15, jump: 1.1, knockback: 1.3 },
  ICE: { ...BASE, id: "ICE", name: "빙판", icon: "🧊", desc: "바닥이 얼었어요. 멈추기가 힘들어요", accel: 0.35, idleFriction: 0.985 },
  BOUNCY: { ...BASE, id: "BOUNCY", name: "풍선", icon: "🎈", desc: "밀치기 2배. 한 방이면 끝", knockback: 2 },
  BLITZ: { ...BASE, id: "BLITZ", name: "번개전", icon: "⏱", desc: "라운드 절반 길이. 바로 승부", duration: 0.55, excludes: [...RACE_MODES, "COIN", "COLOR"] },
  FOG: { ...BASE, id: "FOG", name: "안개", icon: "🌫", desc: "멀리 안 보여요. 가장자리 조심", fog: 0.35, excludes: ["TIPTOE"] },
  SUPERJUMP: { ...BASE, id: "SUPERJUMP", name: "슈퍼점프", icon: "🦘", desc: "점프 1.45배. 장애물은 뛰어넘자", jump: 1.45, gravity: 0.9 },
  DASHMANIA: { ...BASE, id: "DASHMANIA", name: "대시 광란", icon: "💨", desc: "대시 쿨타임 거의 없음. 밀고 또 밀어요", dashCooldown: 0.35, knockback: 1.15, excludes: ["TIPTOE"] },
};

export const MODIFIER_POOL: ModifierId[] = (Object.keys(MODIFIERS) as ModifierId[]).filter((id) => id !== "NONE");

/** Modifiers playable in a mode. */
export function modifiersFor(mode: GameMode): ModifierId[] {
  return MODIFIER_POOL.filter((id) => !MODIFIERS[id].excludes.includes(mode));
}

/** Deterministic pick for a round (same seed + mode → same twist on every host). */
export function rollModifier(seed: number, mode: GameMode): ModifierId {
  const pool = modifiersFor(mode);
  if (pool.length === 0) return "NONE";
  const rng = createRng((seed ^ 0x0d1f1e5) >>> 0);
  return pool[Math.floor(rng() * pool.length)];
}

export function modifierLabel(id: ModifierId): string {
  const m = MODIFIERS[id];
  return id === "NONE" ? "" : `${m.icon} ${m.name}`;
}
