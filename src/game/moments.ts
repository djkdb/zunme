/**
 * Social moments: short callouts derived from round data (never random), shown
 * live as HUD toasts while a round runs and summarised on the result screen.
 * Every moment has a stable key so a client fires it at most once per round.
 */
import type { GameState } from "@/types";
import { computeRanking, hasFinishLine, isScoreMode } from "@/game/authority";
import { seriesMoments } from "@/game/series";

export interface Moment {
  /** unique per round + kind (+ subject) */
  key: string;
  text: string;
  /** bigger = funnier / rarer; result screen keeps the top ones */
  weight: number;
}

type Name = (id: string) => string;

const FAST_OUT_MS = 6_000;
const PHOTO_FINISH_MS = 1_200;

/** Moments visible from the live state (fires while PLAYING as data arrives). */
export function liveMoments(state: GameState, name: Name): Moment[] {
  const out: Moment[] = [];
  if (state.status !== "PLAYING" && state.status !== "FINISHED") return out;
  const r = state.round;
  const elapsed = (id: string) => (state.outAt[id] ?? 0) - state.startAt;

  // ⚡ someone was out within seconds of GO!
  const first = state.eliminationOrder[0];
  if (first && elapsed(first) > 0 && elapsed(first) <= FAST_OUT_MS) {
    out.push({ key: `${r}:fast:${first}`, text: `⚡ ${name(first)} ${Math.max(1, Math.round(elapsed(first) / 1000))}초 만에 탈락`, weight: 3 });
  }
  // 💥 hat-trick and beyond
  for (const [id, ko] of Object.entries(state.knockouts)) {
    if (ko >= 3) out.push({ key: `${r}:ko3:${id}`, text: `🎩 ${name(id)} 해트트릭! ${ko}명 날림`, weight: 4 });
    else if (ko === 2) out.push({ key: `${r}:ko2:${id}`, text: `💥 ${name(id)} 2명 연속 날림`, weight: 2 });
  }
  // 😱 two players out within a second of each other
  const order = state.eliminationOrder;
  for (let i = 1; i < order.length; i++) {
    const a = order[i - 1], b = order[i];
    const gap = Math.abs(elapsed(a) - elapsed(b));
    if (elapsed(a) > 0 && elapsed(b) > 0 && gap <= PHOTO_FINISH_MS) out.push({ key: `${r}:double:${b}`, text: `😱 ${name(a)} · ${name(b)} 동시 낙하`, weight: 3 });
  }
  // ⚔️ last two standing (elimination modes with 3+ players)
  if (!hasFinishLine(state.mode) && !isScoreMode(state.mode) && state.participants.length >= 3 && state.alive.length === 2 && state.status === "PLAYING") {
    out.push({ key: `${r}:final2`, text: `⚔️ 마지막 둘: ${name(state.alive[0])} vs ${name(state.alive[1])}`, weight: 2 });
  }
  // 🏁 someone crossed first with the pack far behind
  if (hasFinishLine(state.mode) && state.finishOrder.length === 1 && state.status === "PLAYING") {
    out.push({ key: `${r}:first:${state.finishOrder[0]}`, text: `🏁 ${name(state.finishOrder[0])} 1등 골인!`, weight: 2 });
  }
  // 🪙 / ⛰ score modes: someone doubled the runner-up
  if (isScoreMode(state.mode) && state.status === "PLAYING") {
    const sorted = [...state.participants].sort((a, b) => (state.scores[b] ?? 0) - (state.scores[a] ?? 0));
    const top = state.scores[sorted[0]] ?? 0, second = state.scores[sorted[1]] ?? 0;
    const minTop = state.mode === "COIN" ? 8 : 8000;
    if (sorted.length >= 2 && top >= minTop && top >= second * 2) out.push({ key: `${r}:dominant:${sorted[0]}`, text: `🚀 ${name(sorted[0])} 독주 중`, weight: 2 });
  }
  return out;
}

/** Moments for the result screen: the round's story plus the series callouts. */
export function roundMoments(state: GameState, name: Name): string[] {
  if (state.status !== "FINISHED") return [];
  const out: Moment[] = liveMoments(state, name).filter((m) => !m.key.includes(":final2") && !m.key.includes(":first:") && !m.key.includes(":dominant:"));
  const winner = state.winnerId;
  const ranking = computeRanking(state);
  const roundMs = state.endAt - state.startAt;
  const brawl = !hasFinishLine(state.mode) && !isScoreMode(state.mode);
  if (winner) {
    // 🍃 won without touching anyone (everyone else fell on their own)
    if (brawl && state.participants.length >= 3 && (state.knockouts[winner] ?? 0) === 0 && state.eliminationOrder.length >= 2) {
      out.push({ key: `${state.round}:clean`, text: `🍃 ${name(winner)} 손 안 대고 승리`, weight: 3 });
    }
    // ⏱ time-out survival with several still standing
    if (brawl && state.alive.length >= 2 && state.eliminationOrder.length > 0) {
      out.push({ key: `${state.round}:timeout`, text: `⏱ ${name(winner)} 끝까지 버텨서 승리`, weight: 1 });
    }
    // 🏁 photo finish
    if (hasFinishLine(state.mode) && state.finishOrder.length >= 2) {
      const a = state.finishOrder[0], b = state.finishOrder[1];
      const gap = (state.outAt[b] ?? 0) - (state.outAt[a] ?? 0);
      if (gap > 0 && gap <= PHOTO_FINISH_MS) out.push({ key: `${state.round}:photo`, text: `📸 ${name(a)} · ${name(b)} 간발의 차 골인`, weight: 4 });
    }
    // 🎯 score domination at the end
    if (isScoreMode(state.mode) && ranking.length >= 2) {
      const top = state.scores[ranking[0]] ?? 0, second = state.scores[ranking[1]] ?? 0;
      if (top > 0 && top >= second * 2) out.push({ key: `${state.round}:crush`, text: `🎯 ${name(ranking[0])} 압도적 점수`, weight: 2 });
      else if (top > 0 && top - second <= (state.mode === "COIN" ? 1 : 600)) out.push({ key: `${state.round}:close`, text: `😬 ${name(ranking[1])} 한 끗 차이`, weight: 3 });
    }
  } else if (brawl && state.eliminationOrder.length === state.participants.length && state.participants.length >= 2) {
    out.push({ key: `${state.round}:wipe`, text: "💀 전원 낙하", weight: 3 });
  }
  // 🐢 a long round with nobody out (survival modes)
  if (brawl && state.eliminationOrder.length === 0 && state.participants.length >= 2 && roundMs >= 40_000) {
    out.push({ key: `${state.round}:peace`, text: "🕊 아무도 안 떨어진 평화의 라운드", weight: 2 });
  }
  const picked = out.sort((a, b) => b.weight - a.weight).slice(0, 2).map((m) => m.text);
  return [...seriesMoments(state, name), ...picked].slice(0, 3);
}
