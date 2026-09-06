"use client";

import { MuteButton } from "@/components/hud/MuteButton";
import { hasFinishLine, isScoreMode, isSuddenDeath, roundEndAt } from "@/game/authority";
import { getPhase } from "@/game/phase";
import { GAME_MODES, TIPTOE_ROWS, TOWER_PLATFORMS } from "@/game/config";
import { COLOR_PALETTE } from "@/game/modes";
import { colorRuntime, partyRuntime } from "@/game/party";
import { RACE_CHECKPOINTS } from "@/game/race";
import { useHostClock } from "@/hooks/useHostClock";
import { useDashCooldown } from "@/hooks/useDashCooldown";
import { GOGUN_PROGRESS_STEP, gogunRuntime } from "@/game/gogun";
import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { selectPlayers, useGameStore } from "@/store/gameStore";

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Polls the GOGUN stage; returns the stage and a key that changes on stage-up (for the banner). */
function useStage(enabled: boolean): number {
  const [stage, setStage] = useState(1);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setStage((prev) => (prev === gogunRuntime.stage ? prev : gogunRuntime.stage)), 150);
    return () => clearInterval(id);
  }, [enabled]);
  return stage;
}

/** Polls the runtime for "an anchor is hookable now" (20 Hz). */
function useWireHint(enabled: boolean): boolean {
  const [hint, setHint] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      const next = gogunRuntime.anchorInRange && !gogunRuntime.wire.active;
      setHint((prev) => (prev === next ? prev : next));
    }, 50);
    return () => clearInterval(id);
  }, [enabled]);
  return enabled && hint;
}

/** COLOR PANIC phase for the banner (polled; the arena writes it every frame). */
function useColorPhase(enabled: boolean): { phase: "roam" | "warn" | "drop"; called: number; msLeft: number } {
  const [v, setV] = useState({ phase: "roam" as "roam" | "warn" | "drop", called: 0, msLeft: 0 });
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      const next = { phase: colorRuntime.phase, called: colorRuntime.called, msLeft: colorRuntime.msLeft };
      setV((prev) => (prev.phase === next.phase && prev.called === next.called && Math.ceil(prev.msLeft / 1000) === Math.ceil(next.msLeft / 1000) ? prev : next));
    }, 100);
    return () => clearInterval(id);
  }, [enabled]);
  return v;
}

function useOnHill(enabled: boolean): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setOn((prev) => (prev === partyRuntime.onHill ? prev : partyRuntime.onHill)), 120);
    return () => clearInterval(id);
  }, [enabled]);
  return enabled && on;
}

export function GameHUD() {
  const players = useGameStore(selectPlayers);
  const state = useGameStore((s) => s.state);
  const localId = useGameStore((s) => s.localId);
  const now = useHostClock(200);
  const mobile = useIsMobile();
  const { dashLeft, dashPct } = useDashCooldown();
  const wireHint = useWireHint(state.mode === "GOGUN" && state.status === "PLAYING");
  const stage = useStage(state.mode === "GOGUN" && state.status === "PLAYING");

  const race = state.mode === "RACE";
  const run = state.mode === "GOGUN";
  const bossMode = state.mode === "BOSS";
  const tag = state.mode === "TAG";
  const bomb = state.mode === "BOMB";
  const crown = state.mode === "CROWN";
  const hill = state.mode === "HILL";
  const coin = state.mode === "COIN";
  const colorMode = state.mode === "COLOR";
  const tiptoe = state.mode === "TIPTOE";
  const tower = state.mode === "TOWER";
  const scoreMode = isScoreMode(state.mode);
  const bossName = bossMode ? (players.find((p) => p.id === state.bossId)?.nickname ?? "?") : "";
  const isBoss = bossMode && state.bossId === localId;
  const finishLine = hasFinishLine(state.mode);
  const infected = tag && state.tagged.includes(localId);
  const tagSurvivors = state.alive.filter((id) => !state.tagged.includes(id)).length;
  const holderName = players.find((p) => p.id === state.holderId)?.nickname ?? "?";
  const isHolder = state.holderId === localId;
  const fuseLeft = bomb ? Math.max(0, state.fuseAt - now) / 1000 : 0;
  const myScore = state.scores[localId] ?? 0;
  const colorPhase = useColorPhase(colorMode && state.status === "PLAYING");
  const onHill = useOnHill(hill && state.status === "PLAYING");
  const calledColor = COLOR_PALETTE[colorPhase.called];
  const modeBanner = state.status === "PLAYING" && (bossMode || tag || bomb || crown || (colorMode && colorPhase.phase !== "roam"));
  const meta = GAME_MODES[state.mode];
  const participants = state.participants.length ? state.participants : players.map((p) => p.id);
  const survivors = state.alive.length;
  const suddenDeath = isSuddenDeath(state, now);
  const remaining = state.status === "COUNTDOWN" ? meta.duration : roundEndAt(state) - now;
  const timeLabel = Math.max(0, Math.ceil(remaining / 1000));
  const hurry = finishLine && state.finishOrder.length > 0;
  const phase = getPhase(state, now);
  const tense = phase === "DANGER" || phase === "SUDDEN" || phase === "FINAL";
  const final2 = !finishLine && !scoreMode && !tag && !modeBanner && state.status === "PLAYING" && survivors === 2 && participants.length > 2;
  const isSpectating = !state.alive.includes(localId) && state.status === "PLAYING";
  const localFinished = finishLine && state.finishOrder.includes(localId);
  const localCp = (state.progress[localId] ?? -1) + 1;
  const roster = participants.map((id) => players.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <div className="pointer-events-none absolute inset-0 z-10 safe-pad">
      {/* top bar */}
      <div className="flex items-start justify-between p-3">
        <div className="chip px-3 py-2 text-xs font-black tracking-widest text-white hud-text sm:text-sm">
          {meta.icon} {meta.name} · {run ? `스테이지 ${stage}` : `${state.round}라운드`}
        </div>
        <div className="chip anim-pop px-4 py-2 text-center text-white">
          <div className="text-[10px] font-bold tracking-[0.3em] text-white/60">
            {run ? "거리" : finishLine ? "완주" : bossMode ? "헌터" : tag ? "생존자" : coin ? "내 코인" : hill ? "언덕 시간" : crown ? "왕관 시간" : "생존자"}
          </div>
          <div className="display text-2xl sm:text-3xl">
            {run ? (
              <>
                {Math.floor(gogunRuntime.distance)}
                <span className="text-white/50"> m · 🪙 {gogunRuntime.coins}</span>
              </>
            ) : coin ? (
              <>🪙 {myScore}</>
            ) : hill || crown ? (
              <>
                {(myScore / 1000).toFixed(1)}
                <span className="text-white/50">s</span>
              </>
            ) : (
              <>
                {finishLine ? state.finishOrder.length : bossMode ? survivors - (state.bossId && state.alive.includes(state.bossId) ? 1 : 0) : tag ? tagSurvivors : survivors}{" "}
                <span className="text-white/50">/ {bossMode ? participants.length - 1 : participants.length}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className={`chip px-3 py-2 text-center text-white ${phase === "FINAL" ? "anim-pulse border-brand bg-brand/80" : suddenDeath || hurry ? "border-brand bg-brand/70" : phase === "DANGER" ? "border-brand-2/60 bg-brand/40" : ""}`}>
            <div className="text-[10px] font-bold tracking-[0.3em] text-white/70">{phase === "FINAL" ? "FINAL" : suddenDeath ? "서든" : hurry ? "서둘러" : phase === "DANGER" ? "위험" : "시간"}</div>
            <div className={`display text-2xl sm:text-3xl ${tense && !suddenDeath ? "text-brand-2" : ""}`}>{timeLabel}</div>
          </div>
          <div className="pointer-events-auto hidden sm:block">
            <MuteButton />
          </div>
        </div>
      </div>

      {/* roster */}
      <ul className="absolute left-3 top-20 hidden flex-col gap-1 sm:flex">
        {roster.map((p) => {
          const alive = state.alive.includes(p.id);
          const finished = state.finishOrder.includes(p.id);
          const dim = race || tiptoe || scoreMode ? false : !alive;
          const prog = state.progress[p.id] ?? -1;
          const marker = (bossMode && state.bossId === p.id) || (crown && state.holderId === p.id) ? "👑 " : bomb && state.holderId === p.id ? "💣 " : tag && state.tagged.includes(p.id) ? "🧟 " : "";
          const score = state.scores[p.id] ?? 0;
          return (
            <li key={p.id} className={`chip flex items-center gap-2 px-3 py-1 text-xs font-bold transition-opacity ${dim ? "text-white/40 line-through" : "text-white"}`}>
              {dim ? <span className="text-[10px] text-white/50">✕</span> : <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.colorHex }} />}
              <span className="max-w-[110px] truncate">{marker}{p.nickname}</span>
              {race && (finished ? <span className="text-brand-2">🏁</span> : <span className="text-white/50">CP{prog + 1}</span>)}
              {run && (finished ? <span className="text-brand-2">🏁</span> : <span className="text-white/50">{Math.max(0, prog) * GOGUN_PROGRESS_STEP}m</span>)}
              {tiptoe && (finished ? <span className="text-brand-2">🏁</span> : <span className="text-white/50">{Math.max(0, prog + 1)}/{TIPTOE_ROWS}줄</span>)}
              {tower && (finished ? <span className="text-brand-2">🏁</span> : <span className="text-white/50">▲{Math.max(0, prog)}/{TOWER_PLATFORMS}</span>)}
              {coin && <span className="text-brand-2">🪙 {score}</span>}
              {(hill || crown) && <span className="text-brand-2">{(score / 1000).toFixed(1)}s</span>}
            </li>
          );
        })}
      </ul>

      {/* race: local checkpoint chip */}
      {race && !localFinished && state.status === "PLAYING" && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2 sm:hidden">
          <div className="chip px-3 py-1 text-[11px] font-black tracking-widest text-white/85">
            체크포인트 {localCp} / {RACE_CHECKPOINTS.length}
          </div>
        </div>
      )}

      {bossMode && state.status === "PLAYING" && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2">
          <div className={`anim-slam display rounded-2xl px-6 py-2 text-2xl shadow-2xl hud-text ${isBoss ? "bg-brand text-white" : "bg-[#12142b]/80 text-brand-2"}`}>{isBoss ? "당신이 보스!" : `⚔️ 보스: ${bossName}`}</div>
        </div>
      )}
      {tag && state.status === "PLAYING" && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2 text-center">
          <div key={infected ? "z" : "s"} className={`anim-slam display rounded-2xl px-6 py-2 text-2xl shadow-2xl hud-text ${infected ? "bg-[#2ed573] text-[#12142b]" : "bg-[#12142b]/80 text-white"}`}>{infected ? "🧟 감염됨 — 닿아서 퍼뜨려!" : `🏃 도망쳐! 감염자 ${state.tagged.length}명`}</div>
        </div>
      )}
      {bomb && state.status === "PLAYING" && state.holderId && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2">
          <div key={state.holderId} className={`anim-slam display rounded-2xl px-6 py-2 text-2xl shadow-2xl hud-text ${isHolder ? (fuseLeft < 3 ? "anim-pulse bg-brand text-white" : "bg-brand text-white") : "bg-[#12142b]/80 text-brand-2"}`}>
            {isHolder ? "💣 넘겨!" : `💣 ${holderName}`} <span className="text-white/80">{fuseLeft.toFixed(1)}s</span>
          </div>
        </div>
      )}
      {crown && state.status === "PLAYING" && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2">
          <div key={state.holderId ?? "none"} className={`anim-slam display rounded-2xl px-6 py-2 text-2xl shadow-2xl hud-text ${isHolder ? "bg-brand-2 text-[#12142b]" : "bg-[#12142b]/80 text-brand-2"}`}>{isHolder ? "👑 왕관 획득 — 도망쳐!" : state.holderId ? `👑 ${holderName}` : "👑 왕관을 잡아라"}</div>
        </div>
      )}
      {hill && onHill && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2">
          <div className="anim-pop display rounded-2xl bg-brand-2 px-5 py-1.5 text-xl text-[#12142b] shadow-2xl">⛰️ 언덕 점령 중</div>
        </div>
      )}
      {colorMode && state.status === "PLAYING" && colorPhase.phase !== "roam" && (
        <div key={`${colorPhase.called}-${colorPhase.phase}`} className="absolute left-1/2 top-24 -translate-x-1/2 text-center">
          <div className="anim-slam display rounded-2xl px-8 py-2 text-4xl shadow-2xl hud-text" style={{ background: calledColor.hex, color: "#12142b" }}>
            {calledColor.name}!
          </div>
          <div className="mt-1 text-xs font-black tracking-widest text-white/85 hud-text">{colorPhase.phase === "warn" ? `${Math.ceil(colorPhase.msLeft / 1000)}초 뒤 타일 낙하` : "버텨!"}</div>
        </div>
      )}
      {colorMode && state.status === "PLAYING" && colorPhase.phase === "roam" && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2">
          <div className="chip px-3 py-1 text-[11px] font-black tracking-widest text-white/85">다음 색까지 {Math.ceil(colorPhase.msLeft / 1000)}초</div>
        </div>
      )}
      {/* banners */}
      {final2 && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2">
          <div className="anim-slam display rounded-2xl bg-brand px-6 py-2 text-3xl text-white shadow-2xl hud-text">최후의 2인</div>
        </div>
      )}
      {suddenDeath && !final2 && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2">
          <div className="anim-slam display rounded-2xl bg-brand px-6 py-2 text-2xl text-white shadow-2xl hud-text">서든 데스</div>
        </div>
      )}
      {run && state.status === "PLAYING" && !isSpectating && !localFinished && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <div className="chip px-3 py-1.5 text-[11px] font-black tracking-widest text-white/85">{mobile ? "탭: 점프 · 공중에서 탭: 와이어" : "SPACE: 점프 · 공중 SPACE: 와이어"}</div>
        </div>
      )}
      {run && stage > 1 && state.status === "PLAYING" && (
        <div key={stage} className="anim-banner pointer-events-none absolute inset-x-0 top-1/4 flex justify-center">
          <div className="anim-slam display text-gradient gradient-shadow text-5xl sm:text-6xl">스테이지 {stage}</div>
        </div>
      )}
      {run && wireHint && (
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2">
          <div className="anim-pulse display rounded-2xl bg-brand-2 px-5 py-1.5 text-2xl text-[#12142b] shadow-2xl">🪝 와이어!</div>
        </div>
      )}
      {!mobile && !run && !isSpectating && !localFinished && state.status === "PLAYING" && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <div className={`chip flex items-center gap-2 px-3 py-1.5 text-[11px] font-black tracking-widest ${dashLeft > 0 ? "text-white/50" : "text-white"}`}>
            <span className="relative inline-block h-3 w-16 overflow-hidden rounded-full bg-white/10">
              <span className={`absolute inset-y-0 left-0 rounded-full ${dashLeft > 0 ? "bg-white/40" : "bg-brand-2"}`} style={{ width: `${dashPct}%` }} />
            </span>
            대시 · SHIFT
          </div>
        </div>
      )}
      {(isSpectating || localFinished) && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="chip px-4 py-2 text-xs font-bold tracking-widest text-white/85">{localFinished ? "🏁 완주! 다른 플레이어 기다리는 중" : "관전 중"}</div>
        </div>
      )}
    </div>
  );
}
