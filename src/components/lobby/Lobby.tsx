"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmoteControls } from "@/components/hud/EmoteControls";
import { itemById } from "@/game/items";
import { SERIES_OPTIONS } from "@/game/series";
import { MODIFIERS, MODIFIER_POOL } from "@/game/modifiers";
import { MuteButton } from "@/components/hud/MuteButton";
import { ShopButton } from "@/components/shop/ShopButton";
import { GAME_MODES, MAX_PLAYERS, MIN_PLAYERS_TO_START } from "@/game/config";
import type { GameMode } from "@/types";
import { sound } from "@/game/audio";
import { roomShareUrl } from "@/lib/room";
import { selectIsHost, selectPlayers, useGameStore } from "@/store/gameStore";

export function Lobby({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const players = useGameStore(selectPlayers);
  const isHost = useGameStore(selectIsHost);
  const localId = useGameStore((s) => s.localId);
  const status = useGameStore((s) => s.state.status);
  const offline = useGameStore((s) => s.offline);
  const startGame = useGameStore((s) => s.startGame);
  const mode = useGameStore((s) => s.state.mode);
  const setMode = useGameStore((s) => s.setMode);
  const partyMix = useGameStore((s) => s.state.partyMix);
  const setPartyMix = useGameStore((s) => s.setPartyMix);
  const seriesTotal = useGameStore((s) => s.state.seriesTotal);
  const modifiersOn = useGameStore((s) => s.state.modifiersOn);
  const setModifiers = useGameStore((s) => s.setModifiers);
  const setSeriesTotal = useGameStore((s) => s.setSeriesTotal);
  const series = useGameStore((s) => s.state.series);
  const seriesRows = players.filter((p) => (series[p.id] ?? 0) > 0).sort((a, b) => (series[b.id] ?? 0) - (series[a.id] ?? 0));
  const leave = useGameStore((s) => s.leave);
  const setReady = useGameStore((s) => s.setReady);
  const round = useGameStore((s) => s.state.round);
  // Ready checks are per round: coming back to the lobby after a round clears ours.
  useEffect(() => {
    if (round > 0) setReady(false);
  }, [round, setReady]);
  const notices = useGameStore((s) => s.roomNotices);
  const [copied, setCopied] = useState(false);
  // toasts expire on their own: a coarse clock re-renders while any are alive
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (notices.length === 0) return;
    const id = setInterval(() => setNow(performance.now()), 700);
    return () => clearInterval(id);
  }, [notices]);
  const liveNotices = now ? notices.filter((n) => now - n.at < 3200) : notices;
  const me = players.find((p) => p.id === localId);
  const [coach, setCoach] = useState(false);
  useEffect(() => {
    try {
      const n = Number(localStorage.getItem("zuuun:coach") ?? "0");
      if (n < 2) {
        localStorage.setItem("zuuun:coach", String(n + 1));
        const show = setTimeout(() => setCoach(true), 600);
        const hide = setTimeout(() => setCoach(false), 12000);
        return () => {
          clearTimeout(show);
          clearTimeout(hide);
        };
      }
    } catch {
      /* ignore */
    }
  }, []);
  const readyCount = players.filter((p) => p.ready).length;
  const othersReady = players.filter((p) => !p.isHost).every((p) => p.ready);

  const copy = async () => {
    sound.play("click");
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const share = async () => {
    sound.play("click");
    const url = roomShareUrl(roomCode);
    const text = `ZUUUN 같이 하자! 방 코드: ${roomCode}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "ZUUUN", text, url });
        return;
      } catch {
        /* cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const canStart = isHost && players.length >= MIN_PLAYERS_TO_START;
  const roundInProgress = status === "PLAYING" || status === "COUNTDOWN";

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col safe-pad">
      <div className="pointer-events-auto flex items-center justify-between p-3">
        <button className="chip px-4 py-2 text-sm font-extrabold text-white" onClick={() => { sound.play("click"); leave(); router.push("/"); }}>
          ← 나가기
        </button>
        <div className="flex items-center gap-2">
          <ShopButton compact />
          <MuteButton />
        </div>
      </div>

      {liveNotices.length > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-20 flex -translate-x-1/2 flex-col items-center gap-1">
          {liveNotices.map((n) => (
            <div key={n.key} className="anim-pop chip px-3 py-1 text-[12px] font-bold text-white">{n.text}</div>
          ))}
        </div>
      )}
      <EmoteControls placement="lobby" />
      {coach && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 short:hidden">
          <div className="anim-rise chip px-4 py-2 text-[12px] font-bold text-white">🎯 기다리는 동안 움직여 보세요 — 허수아비를 대시로 밀쳐 보기!</div>
        </div>
      )}
      <div className="flex min-h-0 flex-1 overflow-y-auto scroll-y px-3 pb-3 short:px-2 short:pb-2">
        <div className="panel anim-rise pointer-events-auto m-auto w-full max-w-md p-5 sm:p-6 md:mr-2 md:ml-auto short:max-w-2xl short:p-4">
          <div className="text-center">
            <div className="display text-3xl text-white sm:text-4xl short:hidden">ZUUUN</div>
            <div className="mt-3 text-[11px] font-bold tracking-[0.35em] text-white/60 short:mt-0">방 코드</div>
            <div className="mt-1 font-mono text-[44px] font-black tracking-[0.3em] text-brand-2 sm:text-[56px] short:text-[36px]">{roomCode}</div>
            <div className="mt-3 flex justify-center gap-2 short:mt-2">
              <button className="btn btn-secondary min-h-12 px-5 text-sm" onClick={copy}>
                {copied ? "복사됨 ✓" : "코드 복사"}
              </button>
              <button className="btn btn-accent min-h-12 px-5 text-sm" onClick={share}>
                공유
              </button>
            </div>
            {offline && <p className="mt-3 text-[11px] font-bold text-brand-2">로컬 모드 — 같은 기기의 다른 탭만 참가할 수 있어요.</p>}
          </div>

          <div className="mt-4 flex items-center justify-between text-xs font-bold tracking-widest text-white/70 short:mt-2">
            <span>게임 모드 {!isHost && <span className="text-white/40">(호스트가 선택)</span>}</span>
            <span className="text-white/40">{Object.keys(GAME_MODES).length}개 모드</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2">
            {(Object.keys(GAME_MODES) as GameMode[]).map((m) => {
              const meta = GAME_MODES[m];
              const active = m === mode;
              return (
                <button
                  key={m}
                  disabled={!isHost || roundInProgress}
                  onClick={() => {
                    sound.play("click");
                    setMode(m);
                  }}
                  className={`rounded-xl border-2 px-2 py-1.5 text-left transition sm:py-2 ${active ? "border-brand-2 bg-brand-2/15" : "border-white/10 bg-white/5"} ${isHost ? "active:scale-95" : "cursor-default"}`}
                >
                  <div className="text-base leading-none sm:text-lg">{meta.icon}</div>
                  <div className={`mt-1 text-[11px] font-black leading-tight sm:text-[12px] ${active ? "text-brand-2" : "text-white"}`}>{meta.name}</div>
                  <div className="hidden text-[9px] font-bold tracking-wider text-white/50 sm:block">{meta.tagline}</div>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-center text-[11px] font-semibold text-white/70 short:text-[10px]">{GAME_MODES[mode].description}</p>
          <div className="mt-2 flex items-center justify-between rounded-xl border-2 border-white/10 bg-white/5 px-2 py-1.5">
            <span className="px-1 text-[11px] font-black tracking-widest text-white/80">🏆 파티 시리즈</span>
            <div className="flex gap-1">
              {SERIES_OPTIONS.map((n) => (
                <button
                  key={n}
                  disabled={!isHost || roundInProgress}
                  onClick={() => {
                    sound.play("click");
                    setSeriesTotal(n);
                  }}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-black ${seriesTotal === n ? "bg-brand-2 text-[#12142b]" : "bg-white/10 text-white/70"} ${isHost ? "active:scale-95" : "cursor-default"}`}
                >
                  {n === 1 ? "단판" : `${n}판`}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1 text-center text-[10px] font-semibold text-white/50">
            {seriesTotal > 1 ? `${seriesTotal}라운드 · 매 라운드 다른 모드 · 1·2·3위 3/2/1점 · 챔피언 1명` : "한 판씩 · 호스트가 매번 모드를 고릅니다"}
          </p>
          <button
            disabled={!isHost || roundInProgress}
            onClick={() => {
              sound.play("click");
              setModifiers(!modifiersOn);
            }}
            className={`mt-2 flex w-full items-center justify-between rounded-xl border-2 px-3 py-1.5 text-[11px] font-black tracking-widest ${modifiersOn ? "border-brand-2 bg-brand-2/15 text-brand-2" : "border-white/10 bg-white/5 text-white/70"} ${isHost ? "active:scale-[0.98]" : "cursor-default"}`}
          >
            <span>🎲 게임 모디파이어 — 매 라운드 랜덤 변칙</span>
            <span>{modifiersOn ? "켜짐" : "꺼짐"}</span>
          </button>
          {modifiersOn && (
            <p className="mt-1 text-center text-[10px] font-semibold text-white/50">{MODIFIER_POOL.map((id) => `${MODIFIERS[id].icon} ${MODIFIERS[id].name}`).join(" · ")}</p>
          )}
          {seriesTotal === 1 && (
            <button
              disabled={!isHost || roundInProgress}
              onClick={() => {
                sound.play("click");
                setPartyMix(!partyMix);
              }}
              className={`mt-2 flex w-full items-center justify-between rounded-xl border-2 px-3 py-1.5 text-[11px] font-black tracking-widest ${partyMix ? "border-brand-2 bg-brand-2/15 text-brand-2" : "border-white/10 bg-white/5 text-white/70"} ${isHost ? "active:scale-[0.98]" : "cursor-default"}`}
            >
              <span>🎲 파티 믹스 — 매 라운드 모드 순환</span>
              <span>{partyMix ? "켜짐" : "꺼짐"}</span>
            </button>
          )}
          {seriesRows.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-white/80">
              <span className="text-white/50">시리즈</span>
              {seriesRows.map((p) => (
                <span key={p.id} className="rounded-full bg-white/10 px-2 py-0.5">
                  {p.nickname} <span className="text-brand-2">{series[p.id]}</span>
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-xs font-bold tracking-widest text-white/70 short:mt-2">
            <span>플레이어</span>
            <span>
              {players.length} / {MAX_PLAYERS}
            </span>
          </div>
          <ul className="mt-2 grid grid-cols-2 gap-2 pr-1 sm:max-h-32 sm:overflow-y-auto sm:scroll-y short:grid-cols-4">
            {players.map((p) => {
              const gear = (["hat", "face", "back", "trail"] as const)
                .map((slot) => itemById(p.cosmetics[slot]))
                .filter((it) => it && it.price > 0)
                .map((it) => it!.emoji)
                .join("");
              return (
                <li key={p.id} className={`anim-pop flex min-w-0 items-center gap-2 rounded-xl px-3 py-2 ${p.ready ? "bg-[#2ed573]/15 ring-1 ring-[#2ed573]/60" : "bg-white/8"}`}>
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: p.colorHex, boxShadow: `0 0 10px ${p.colorHex}` }} />
                  <span className="min-w-0 truncate text-sm font-bold text-white">
                    {p.nickname}
                    {p.id === localId && <span className="text-white/50"> (나)</span>}
                  </span>
                  {gear && <span className="shrink-0 text-[12px]" title="장착 아이템">{gear}</span>}
                  <span className="shrink-0 rounded-full bg-white/10 px-1.5 text-[9px] font-black text-brand-2">LV{p.level ?? 1}</span>
                  {p.isHost ? <span className="ml-auto shrink-0 whitespace-nowrap text-[10px] font-black text-brand-2">호스트</span> : p.ready ? <span className="ml-auto shrink-0 whitespace-nowrap text-[10px] font-black text-[#2ed573]">준비 ✓</span> : null}
                </li>
              );
            })}
            {Array.from({ length: Math.max(0, Math.min(MAX_PLAYERS, 2) - players.length) }).map((_, i) => (
              <li key={`empty-${i}`} className="flex items-center gap-2 rounded-xl border border-dashed border-white/15 px-3 py-2 text-sm font-semibold text-white/30">
                대기 중…
              </li>
            ))}
          </ul>

          <div className="sticky -bottom-5 mt-5 -mx-5 bg-[#1a1c36]/95 px-5 pb-1 pt-3 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:pt-0 sm:backdrop-blur-none short:-bottom-4 short:-mx-4 short:mt-3 short:px-4">
            {roundInProgress ? (
              <div className="rounded-2xl bg-white/10 p-3 text-center text-sm font-bold text-white/80">라운드 진행 중 — 다음 라운드에 참가해요.</div>
            ) : isHost ? (
              <button className={`btn btn-primary w-full text-xl ${players.length > 1 && othersReady ? "anim-pulse" : ""}`} disabled={!canStart} onClick={() => { sound.play("click"); startGame(); }}>
                <span className="btn-icon">▶</span> {seriesTotal > 1 ? `시리즈 시작 · ${seriesTotal}판` : "게임 시작"}
                {players.length > 1 && <span className="text-sm font-bold text-white/80">준비 {readyCount}/{players.length - 1}</span>}
              </button>
            ) : (
              <button className={`btn w-full text-lg ${me?.ready ? "btn-ghost" : "btn-accent"}`} onClick={() => { sound.play("click"); setReady(!me?.ready); }}>
                {me?.ready ? "✓ 준비 완료 — 취소" : "준비 완료!"}
              </button>
            )}
            {isHost && GAME_MODES[mode].minPlayers > players.length && !roundInProgress && (
              <p className="mt-2 text-center text-[11px] font-semibold text-brand-2">{GAME_MODES[mode].name}은(는) {GAME_MODES[mode].minPlayers}명 이상이 필요해요 — 혼자 시작하면 둘러보기만 가능합니다.</p>
            )}
            {isHost && players.length < 2 && !roundInProgress && GAME_MODES[mode].minPlayers <= players.length && (
              <p className="mt-2 text-center text-[11px] font-semibold text-white/55 short:hidden">코드를 공유하세요 — 친구와 하면 훨씬 재밌어요. 혼자 시작해서 연습할 수도 있어요.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
