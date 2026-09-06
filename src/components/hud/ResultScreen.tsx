"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatClock } from "@/components/hud/GameHUD";
import { computeRanking, hasFinishLine, isScoreMode, teamLabel } from "@/game/authority";
import { GAME_MODES, SERIES_CHAMPION_BONUS, SERIES_FINISH_BONUS } from "@/game/config";
import { sound } from "@/game/audio";
import { roomShareUrl } from "@/lib/room";
import { selectIsHost, selectPlayers, useGameStore } from "@/store/gameStore";
import { useWalletStore } from "@/store/walletStore";
import { useProgressStore } from "@/store/progressStore";
import { levelFromXp } from "@/game/progression";
import { ShopButton } from "@/components/shop/ShopButton";
import { rewardKey } from "@/game/rewards";
import { hostNow } from "@/game/clock";
import { modifierLabel } from "@/game/modifiers";
import { isSeries, roundResultLabel, seriesActive, seriesStandings } from "@/game/series";
import { roundMoments } from "@/game/moments";
import type { GameState } from "@/types";

const MEDALS = ["🥇", "🥈", "🥉"];

/** Seconds until the next series round auto-starts (host clock), coarse so it re-renders once per second. */
function useNextGameCountdown(nextAt: number): number | null {
  const calc = () => (nextAt > 0 ? Math.max(0, Math.ceil((nextAt - hostNow()) / 1000)) : null);
  const [secs, setSecs] = useState<number | null>(calc);
  useEffect(() => {
    if (nextAt <= 0) return;
    const id = setInterval(() => setSecs(calc()), 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextAt]);
  return nextAt > 0 ? secs : null;
}

/** Per-round series table: one row per player, R1..Rn + total, ordered by standings. */
function SeriesBoard({ state, name, color, localId, compact, ids, present }: { state: GameState; name: (id: string) => string; color: (id: string) => string; localId: string; compact?: boolean; ids: string[]; present: (id: string) => boolean }) {
  const order = seriesStandings(state, ids);
  const rounds = state.seriesRounds;
  const slots = Array.from({ length: state.seriesTotal }, (_, i) => rounds[i] ?? null);
  return (
    <div className="overflow-x-auto rounded-xl bg-white/5">
      <table className="w-full min-w-[260px] border-collapse text-[11px] font-bold tabular-nums">
        <thead>
          <tr className="text-[9px] tracking-widest text-white/45">
            <th className="px-2 py-1 text-left">시리즈 순위</th>
            {slots.map((r, i) => (
              <th key={i} className={`px-1 py-1 text-center ${r ? "text-white/60" : "text-white/25"}`} title={r ? GAME_MODES[r.mode].name : "예정"}>
                {r ? GAME_MODES[r.mode].icon : `R${i + 1}`}
              </th>
            ))}
            <th className="px-2 py-1 text-right text-brand-2">합계</th>
          </tr>
        </thead>
        <tbody>
          {order.map((id, i) => (
            <tr key={id} className={`anim-rise ${i === 0 ? "bg-brand-2/15 text-white" : "text-white/85"}`} style={{ animationDelay: `${0.1 + i * 0.08}s` }}>
              <td className="max-w-[110px] px-2 py-1">
                <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: color(id) }} />
                <span className={`truncate align-middle ${present(id) ? "" : "text-white/40 line-through"}`}>{MEDALS[i] ?? `${i + 1}.`} {name(id)}{id === localId ? " (나)" : ""}</span>
              </td>
              {slots.map((r, j) => {
                const pts = r ? (r.points[id] ?? 0) : null;
                const label = r ? roundResultLabel(r, id) : "";
                return (
                  <td key={j} className={`px-1 py-1 text-center ${pts ? (pts === 3 ? "text-brand-2" : "text-white/80") : "text-white/30"}`}>
                    {r ? (compact ? pts : label === "WIN" ? "🏆" : pts || "·") : "·"}
                  </td>
                );
              })}
              <td className="px-2 py-1 text-right text-sm text-brand-2">{state.series[id] ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ResultScreen({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const players = useGameStore(selectPlayers);
  const state = useGameStore((s) => s.state);
  const isHost = useGameStore(selectIsHost);
  const localId = useGameStore((s) => s.localId);
  const playAgain = useGameStore((s) => s.playAgain);
  const returnToLobby = useGameStore((s) => s.returnToLobby);
  const leave = useGameStore((s) => s.leave);
  const reward = useWalletStore((s) => s.lastReward);
  const points = useWalletStore((s) => s.points);
  const earned = reward && reward.key === rewardKey(state) ? reward.points : 0;
  const report = useProgressStore((s) => s.lastReport);
  const xp = useProgressStore((s) => s.xp);
  const lines = report && report.key === rewardKey(state) ? report.lines : [];
  const level = levelFromXp(xp).level;
  const [phase, setPhase] = useState<"hold" | "splash" | "champion" | "panel">("hold");
  const [shared, setShared] = useState(false);
  const champion = state.seriesChampion;
  const inSeries = isSeries(state) && state.seriesRound > 0;
  const nextRoundPending = seriesActive(state) && state.nextAt > 0;
  const nextMode = nextRoundPending ? state.seriesModes[state.seriesRound] : null;
  const nextMeta = nextMode ? GAME_MODES[nextMode] : null;
  const countdown = useNextGameCountdown(state.nextAt);

  // Let the final elimination land (slow-mo + banner) before the WINNER splash, then the panel.
  // A decided series adds a SERIES CHAMPION splash between the round winner and the panel.
  useEffect(() => {
    const final = !!champion;
    const a = setTimeout(() => setPhase("splash"), 1600);
    const c = final ? setTimeout(() => setPhase("champion"), 3600) : null;
    const b = setTimeout(() => setPhase("panel"), final ? 6200 : 4200);
    return () => {
      clearTimeout(a);
      if (c) clearTimeout(c);
      clearTimeout(b);
    };
  }, [champion]);
  const showPanel = phase === "panel";

  const seen = useGameStore((s) => s.seen);
  const claimed = useProgressStore((s) => s.claimed);
  const name = (id: string) => players.find((p) => p.id === id)?.nickname ?? seen[id]?.nickname ?? "???";
  const color = (id: string) => players.find((p) => p.id === id)?.colorHex ?? seen[id]?.colorHex ?? "#ffffff";
  const present = (id: string) => players.some((p) => p.id === id);
  const bonusClaimed = claimed.includes(`series:${state.seriesSeed}`);
  const ranking = computeRanking(state);
  const winner = state.winnerId;
  const survived = formatClock(state.endAt - state.startAt);
  const race = hasFinishLine(state.mode);
  const scoreMode = isScoreMode(state.mode);
  const bossMode = state.mode === "BOSS";
  const teamWon = state.team.length > 0;
  const winnerLabel = bossMode ? "보스 승리" : state.mode === "TAG" ? (state.tagged[0] === winner ? "감염 승리" : "최후의 생존자") : scoreMode ? "최고 점수" : state.mode === "BOMB" ? "최후의 1인" : "승리";
  const noWinnerLabel = state.mode === "GOGUN" ? "전멸" : race ? "시간 초과" : scoreMode ? "점수 없음" : "무승부";
  const scoreOf = (id: string) => (state.mode === "COIN" ? `🪙 ${state.scores[id] ?? 0}` : `${((state.scores[id] ?? 0) / 1000).toFixed(1)}s`);
  const series = state.series;
  const seriesRows = inSeries ? [] : players.filter((p) => (series[p.id] ?? 0) > 0).sort((a, b) => (series[b.id] ?? 0) - (series[a.id] ?? 0));
  const moments = roundMoments(state, name);
  const lastRound = state.seriesRounds[state.seriesRounds.length - 1];
  const myRoundPts = lastRound?.points[localId] ?? 0;
  const meta = GAME_MODES[state.mode];
  const eliminations = state.eliminationOrder.length;
  const dnf = race ? state.participants.length - state.finishOrder.length : 0;
  const lastToFall = state.eliminationOrder[state.eliminationOrder.length - 1];
  const youWon = winner === localId;
  const myKo = state.knockouts[localId] ?? 0;
  const myRank = ranking.indexOf(localId) + 1;
  /** seconds a player lasted (or the round length for survivors / finishers) */
  const lasted = (id: string) => {
    const out = state.outAt[id];
    return Math.max(0, ((out && out > state.startAt ? out : state.endAt) - state.startAt) / 1000);
  };
  const mySurvival = lasted(localId);

  const share = async () => {
    sound.play("click");
    const url = roomShareUrl(roomCode);
    const headline = teamWon ? `⚔️ ${teamLabel(state.mode)}` : winner ? `🏆 ${name(winner)} 승리!` : race ? "⏱ 아무도 완주 못 함" : scoreMode ? "🤷 점수 없음" : "💀 생존자 없음";
    const mine = [
      `${MEDALS[myRank - 1] ?? "🏅"} ${myRank}위 / ${state.participants.length}명`,
      myKo > 0 ? `💥 ${myKo}명 날림` : null,
      scoreMode ? `🎯 ${scoreOf(localId)}` : `⏱ ${mySurvival.toFixed(1)}초`,
    ].filter(Boolean);
    const momentLine = moments[0] ? `\n${moments[0]}` : "";
    const seriesLine = champion ? `\n👑 시리즈 챔피언: ${name(champion)} (${state.series[champion] ?? 0}점 / ${state.seriesTotal}판)` : inSeries ? `\n🏆 시리즈 ${state.seriesRound}/${state.seriesTotal} · 내 점수 ${series[localId] ?? 0}` : "";
    const text = `ZUUUN\n\n${headline}\n${meta.icon} ${meta.name}${seriesLine}${momentLine}\n\n${mine.join("\n")}\n\n같이 하기: ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "ZUUUN", text, url });
        return;
      } catch {
        /* cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col safe-pad">
      {/* Winner splash */}
      {phase === "splash" && (
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="anim-slam display text-gradient gradient-shadow text-6xl sm:text-8xl">{teamWon ? teamLabel(state.mode) : winner ? winnerLabel : noWinnerLabel}</div>
          {winner && (
            <div className="anim-rise delay-2 display mt-3 text-4xl text-white hud-text sm:text-5xl" style={{ color: color(winner) }}>
              {name(winner)}
            </div>
          )}
        </div>
      )}

      {/* Series champion splash */}
      {phase === "champion" && champion && (
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="anim-rise text-[12px] font-black tracking-[0.5em] text-white/70">PARTY SERIES · BEST OF {state.seriesTotal}</div>
          <div className="anim-slam display text-gradient gradient-shadow mt-1 text-5xl sm:text-7xl">👑 시리즈 챔피언</div>
          <div className="anim-rise delay-2 display mt-3 text-4xl text-white hud-text sm:text-6xl" style={{ color: color(champion) }}>
            {name(champion)}
          </div>
          <div className="anim-rise delay-3 mt-2 rounded-full bg-brand-2 px-4 py-1 text-sm font-black text-[#12142b]">{state.series[champion] ?? 0}점</div>
        </div>
      )}

      {showPanel && (
        <div className="flex min-h-0 flex-1 overflow-y-auto scroll-y px-3 py-3 short:px-2 short:py-2">
          <div className="panel anim-rise pointer-events-auto m-auto w-full max-w-md p-5 sm:p-6 short:max-w-2xl short:p-4">
            <div className="text-center">
              {inSeries && (
                <div className="mb-1 text-[10px] font-black tracking-[0.3em] text-brand-2">
                  {champion ? `🏁 FINAL RESULT · BEST OF ${state.seriesTotal}` : `PARTY SERIES · ROUND ${state.seriesRound} / ${state.seriesTotal}`}
                </div>
              )}
              <div className="text-[11px] font-black tracking-[0.4em] text-white/60">
                {meta.icon} {meta.name}
                {state.modifier !== "NONE" && <span className="ml-2 tracking-normal text-brand-2">🎲 {modifierLabel(state.modifier)}</span>}
              </div>
              <div className="display mt-1 text-2xl text-brand-2">{teamWon ? `⚔️ ${teamLabel(state.mode)}` : winner ? `${bossMode ? "👑" : "🏆"} ${winnerLabel}` : state.mode === "GOGUN" ? "💀 전멸" : race ? "⏱ 완주자 없음" : scoreMode ? "🤷 점수 없음" : "💀 생존자 없음"}</div>
              {winner && (
                <div className="display mt-1 text-4xl sm:text-5xl" style={{ color: color(winner) }}>
                  {name(winner)}
                  {youWon && <span className="ml-2 text-lg text-white/70">(나!)</span>}
                </div>
              )}
            </div>

            {champion && (
              <div className="anim-pop mt-3 rounded-2xl border-2 border-brand-2/60 bg-brand-2/15 p-3 text-center">
                <div className="text-[10px] font-black tracking-[0.4em] text-brand-2">👑 SERIES CHAMPION</div>
                <div className="display mt-0.5 text-3xl" style={{ color: color(champion) }}>
                  {name(champion)}
                  {champion === localId && <span className="ml-2 text-base text-white/70">(나!)</span>}
                </div>
                <div className="mt-0.5 text-xs font-bold text-white/70">{state.series[champion] ?? 0}점 · {state.seriesRounds.filter((r) => r.winnerId === champion).length}승 / {state.seriesTotal}판</div>
                {bonusClaimed && (
                  <div className="anim-pop mt-1 inline-block rounded-full bg-brand-2 px-3 py-0.5 text-[11px] font-black text-[#12142b]">
                    {champion === localId ? `🏆 챔피언 보너스 +${SERIES_CHAMPION_BONUS} 포인트` : `🎉 시리즈 완주 +${SERIES_FINISH_BONUS} 포인트`}
                  </div>
                )}
              </div>
            )}
            {inSeries && !champion && myRoundPts > 0 && (
              <div className="mt-2 text-center text-xs font-black text-brand-2">시리즈 +{myRoundPts}점 · 현재 {series[localId] ?? 0}점</div>
            )}
            {moments.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                {moments.map((m, i) => (
                  <span key={i} className="anim-pop rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-black text-white/90" style={{ animationDelay: `${0.2 + i * 0.15}s` }}>
                    {m}
                  </span>
                ))}
              </div>
            )}

            {earned > 0 && (
              <div className="anim-pop mt-3">
                <div className="flex items-center justify-center gap-2">
                  <div className="rounded-full bg-brand-2 px-4 py-1 text-sm font-black text-[#12142b]">+{earned} 포인트</div>
                  <div className="text-xs font-bold text-white/60">⭐ {points} · Lv.{level}</div>
                </div>
                {lines.length > 0 && (
                  <ul className="mx-auto mt-2 max-w-xs space-y-0.5 text-[11px] font-bold sm:max-h-24 sm:overflow-y-auto sm:scroll-y">
                    {lines.map((l, i) => (
                      <li key={i} className={`flex justify-between ${l.points < 0 ? "text-white/40" : l.label.startsWith("미션") || l.label.startsWith("레벨") || /^[^\p{L}\p{N}#]/u.test(l.label) ? "text-brand-2" : "text-white/75"}`}>
                        <span className="truncate">{l.label}</span>
                        <span>{l.points >= 0 ? "+" : ""}{l.points}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="my-4 grid grid-cols-3 gap-2 border-y border-white/15 py-3 text-center">
              <div>
                <div className="display text-xl text-white">{state.participants.length}</div>
                <div className="text-[10px] font-bold tracking-widest text-white/55">플레이어</div>
              </div>
              <div>
                <div className="display text-xl text-white">{survived}</div>
                <div className="text-[10px] font-bold tracking-widest text-white/55">{race ? "라운드 시간" : "생존 시간"}</div>
              </div>
              <div>
                <div className="display text-xl text-white">{race ? dnf : scoreMode ? scoreOf(localId) : eliminations}</div>
                <div className="text-[10px] font-bold tracking-widest text-white/55">{race ? "미완주" : scoreMode ? "내 점수" : "탈락"}</div>
              </div>
            </div>

            {inSeries && (
              <div className="mb-3">
                <SeriesBoard state={state} name={name} color={color} localId={localId} compact={state.seriesTotal > 5} present={present} ids={Array.from(new Set([...state.participants, ...players.map((p) => p.id)]))} />
              </div>
            )}
            {nextRoundPending && nextMeta && (
              <div className="anim-rise mb-3 rounded-2xl border-2 border-white/15 bg-white/5 p-3">
                <div className="flex items-center justify-between text-[10px] font-black tracking-[0.3em] text-white/55">
                  <span>NEXT GAME · ROUND {state.seriesRound + 1} / {state.seriesTotal}</span>
                  {countdown !== null && <span className="display text-lg tracking-normal text-brand-2">{countdown}</span>}
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <span className="text-3xl">{nextMeta.icon}</span>
                  <div className="min-w-0">
                    <div className="display text-xl text-white">{nextMeta.name}</div>
                    <div className="truncate text-[11px] font-bold text-white/65">{nextMeta.tagline}</div>
                  </div>
                </div>
              </div>
            )}
            {seriesRows.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-bold text-white/80">
                <span className="text-white/50">시리즈</span>
                {seriesRows.map((p) => (
                  <span key={p.id} className="rounded-full bg-white/10 px-2 py-0.5">
                    {name(p.id)} <span className="text-brand-2">{series[p.id]}</span>
                  </span>
                ))}
              </div>
            )}
            {!race && !scoreMode && lastToFall && (
              <div className="mb-3 flex items-center justify-center gap-2 text-sm font-bold text-white/80">
                <span>💀 마지막 탈락</span>
                <span style={{ color: color(lastToFall) }}>{name(lastToFall)}</span>
              </div>
            )}

            {ranking.length >= 2 && (
              <div className="mb-3 flex items-end justify-center gap-2 short:hidden">
                {[1, 0, 2].map((idx, col) => {
                  const id = ranking[idx];
                  if (!id) return <div key={col} className="w-16" />;
                  const h = idx === 0 ? 56 : idx === 1 ? 40 : 28;
                  return (
                    <div key={id} className="flex w-16 flex-col items-center">
                      <span className="mb-1 max-w-full truncate text-[10px] font-black text-white/85">{name(id)}</span>
                      <div className="podium-bar w-full rounded-t-lg" style={{ height: h, background: color(id), animationDelay: `${col * 0.1}s`, boxShadow: `0 0 16px ${color(id)}66` }} />
                      <span className="mt-1 text-sm">{MEDALS[idx]}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mb-1 flex items-center justify-between px-3 text-[9px] font-black tracking-widest text-white/40">
              <span>순위</span>
              <span className="flex gap-3">
                <span title="날린 수">💥</span>
                <span title="떨어진 수">🕳</span>
                <span>{scoreMode ? "점수" : "시간"}</span>
                <span title="시리즈 승">🏆</span>
              </span>
            </div>
            <ol className="space-y-1 pr-1 sm:max-h-44 sm:overflow-y-auto sm:scroll-y">
              {ranking.map((id, i) => (
                <li key={id} className={`anim-rise flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-bold ${i === 0 ? "bg-brand-2/20 text-white" : "bg-white/5 text-white/85"}`} style={{ animationDelay: `${0.12 + i * 0.09}s` }}>
                  <span className="w-6 text-center">{MEDALS[i] ?? `${i + 1}.`}</span>
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color(id) }} />
                  <span className="min-w-0 truncate">{name(id)}</span>
                  {id === localId && <span className="shrink-0 text-white/50">(나)</span>}
                  {teamWon && state.team.includes(id) && <span className="shrink-0 text-brand-2">승</span>}
                  <span className="ml-auto flex shrink-0 gap-3 text-[12px] tabular-nums text-white/75">
                    <span className={state.knockouts[id] ? "text-brand-2" : ""}>{state.knockouts[id] ?? 0}</span>
                    <span>{state.falls[id] ?? 0}</span>
                    <span>{scoreMode ? scoreOf(id) : `${lasted(id).toFixed(0)}s`}</span>
                    <span>{series[id] ?? 0}</span>
                  </span>
                </li>
              ))}
            </ol>

            <div className="mt-4 flex flex-col gap-2">
              {isHost ? (
                <div className="flex gap-2">
                  <button className="btn btn-primary min-h-14 flex-[2] text-lg" onClick={() => { sound.play("click"); playAgain(); }}>
                    <span className="btn-icon">{champion ? "🏆" : nextRoundPending ? "▶" : "🔁"}</span> {champion ? "리매치" : nextRoundPending ? "바로 시작" : "다시 하기"}
                  </button>
                  <button className="btn btn-secondary min-h-14 flex-1 text-sm" onClick={() => { sound.play("click"); returnToLobby(); }}>
                    {nextRoundPending ? "⏹ 시리즈 종료" : "🎮 모드 바꾸기"}
                  </button>
                </div>
              ) : (
                <div className="anim-pulse rounded-2xl bg-white/10 p-3 text-center text-sm font-bold text-white/80">
                  {nextRoundPending && countdown !== null ? `다음 게임까지 ${countdown}초…` : champion ? "호스트가 리매치를 시작하길 기다리는 중…" : "호스트가 다음 라운드를 시작하길 기다리는 중…"}
                </div>
              )}
              <div className="flex gap-2">
                <button className="btn btn-accent min-h-12 flex-1 text-sm" onClick={share}>
                  {shared ? "복사됨 ✓" : "📤 결과 공유"}
                </button>
                <button className="btn btn-ghost min-h-12 flex-1 text-sm" onClick={() => { sound.play("click"); returnToLobby(); }}>
                  로비
                </button>
              </div>
              <div className="flex items-center justify-between">
                <ShopButton compact />
                <button className="text-center text-xs font-bold text-white/50" onClick={() => { leave(); router.push("/"); }}>
                  방 나가기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
