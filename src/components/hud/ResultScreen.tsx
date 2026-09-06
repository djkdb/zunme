"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatClock } from "@/components/hud/GameHUD";
import { computeRanking, hasFinishLine, isScoreMode, teamLabel } from "@/game/authority";
import { GAME_MODES } from "@/game/config";
import { sound } from "@/game/audio";
import { roomShareUrl } from "@/lib/room";
import { selectIsHost, selectPlayers, useGameStore } from "@/store/gameStore";
import { useWalletStore } from "@/store/walletStore";
import { useProgressStore } from "@/store/progressStore";
import { levelFromXp } from "@/game/progression";
import { ShopButton } from "@/components/shop/ShopButton";
import { rewardKey } from "@/game/rewards";

const MEDALS = ["🥇", "🥈", "🥉"];

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
  const [phase, setPhase] = useState<"hold" | "splash" | "panel">("hold");
  const [shared, setShared] = useState(false);

  // Let the final elimination land (slow-mo + banner) before the WINNER splash, then the panel.
  useEffect(() => {
    const a = setTimeout(() => setPhase("splash"), 1600);
    const b = setTimeout(() => setPhase("panel"), 4200);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);
  const showPanel = phase === "panel";

  const name = (id: string) => players.find((p) => p.id === id)?.nickname ?? "???";
  const color = (id: string) => players.find((p) => p.id === id)?.colorHex ?? "#ffffff";
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
  const seriesRows = players.filter((p) => (series[p.id] ?? 0) > 0).sort((a, b) => (series[b.id] ?? 0) - (series[a.id] ?? 0));
  const meta = GAME_MODES[state.mode];
  const eliminations = state.eliminationOrder.length;
  const dnf = race ? state.participants.length - state.finishOrder.length : 0;
  const lastToFall = state.eliminationOrder[state.eliminationOrder.length - 1];
  const youWon = winner === localId;

  const share = async () => {
    sound.play("click");
    const url = roomShareUrl(roomCode);
    const headline = teamWon ? `⚔️ ${meta.name}: ${teamLabel(state.mode)}!` : winner ? `🏆 ${name(winner)}님이 ${meta.name}에서 승리!` : race ? `⏱ ${meta.name}: 아무도 완주 못 함!` : `💀 ${meta.name}: 생존자 없음!`;
    const stats = race ? `${state.participants.length}명 · ${survived} · 미완주 ${dnf}` : `${state.participants.length}명 · 생존 ${survived} · 탈락 ${eliminations}`;
    const text = `${headline}\n${stats}\n같이 하기: ${url}`;
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

      {showPanel && (
        <div className="flex min-h-0 flex-1 overflow-y-auto scroll-y px-3 py-3 short:px-2 short:py-2">
          <div className="panel anim-rise pointer-events-auto m-auto w-full max-w-md p-5 sm:p-6 short:max-w-2xl short:p-4">
            <div className="text-center">
              <div className="text-[11px] font-black tracking-[0.4em] text-white/60">{meta.icon} {meta.name}</div>
              <div className="display mt-1 text-2xl text-brand-2">{teamWon ? `⚔️ ${teamLabel(state.mode)}` : winner ? `${bossMode ? "👑" : "🏆"} ${winnerLabel}` : state.mode === "GOGUN" ? "💀 전멸" : race ? "⏱ 완주자 없음" : scoreMode ? "🤷 점수 없음" : "💀 생존자 없음"}</div>
              {winner && (
                <div className="display mt-1 text-4xl sm:text-5xl" style={{ color: color(winner) }}>
                  {name(winner)}
                  {youWon && <span className="ml-2 text-lg text-white/70">(나!)</span>}
                </div>
              )}
            </div>

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
            <ol className="space-y-1 pr-1 sm:max-h-40 sm:overflow-y-auto sm:scroll-y short:grid short:grid-cols-2 short:gap-1 short:space-y-0">
              {ranking.map((id, i) => (
                <li key={id} className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-bold ${i === 0 ? "bg-brand-2/20 text-white" : "bg-white/5 text-white/85"}`}>
                  <span className="w-6 text-center">{MEDALS[i] ?? `${i + 1}.`}</span>
                  <span className="h-3 w-3 rounded-full" style={{ background: color(id) }} />
                  <span className="truncate">{name(id)}</span>
                  {id === localId && <span className="text-white/50">(나)</span>}
                  {scoreMode && <span className="ml-auto text-brand-2">{scoreOf(id)}</span>}
                  {teamWon && state.team.includes(id) && <span className="ml-auto text-brand-2">승</span>}
                </li>
              ))}
            </ol>

            <div className="mt-4 flex flex-col gap-2">
              {isHost ? (
                <button className="btn btn-primary w-full text-lg" onClick={() => { sound.play("click"); playAgain(); }}>
                  다시 하기
                </button>
              ) : (
                <div className="anim-pulse rounded-2xl bg-white/10 p-3 text-center text-sm font-bold text-white/80">호스트가 다음 라운드를 시작하길 기다리는 중…</div>
              )}
              <div className="flex gap-2">
                <button className="btn btn-accent min-h-12 flex-1 text-sm" onClick={share}>
                  {shared ? "복사됨 ✓" : "결과 공유"}
                </button>
                <button className="btn btn-ghost min-h-12 flex-1 text-sm" onClick={() => { sound.play("click"); returnToLobby(); }}>
                  {isHost ? "로비로 돌아가기" : "로비"}
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
