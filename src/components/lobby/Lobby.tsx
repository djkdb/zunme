"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
  const series = useGameStore((s) => s.state.series);
  const seriesRows = players.filter((p) => (series[p.id] ?? 0) > 0).sort((a, b) => (series[b.id] ?? 0) - (series[a.id] ?? 0));
  const leave = useGameStore((s) => s.leave);
  const [copied, setCopied] = useState(false);

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
    const text = `Join my DROPZONE room! Code: ${roomCode}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "DROPZONE", text, url });
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
          ← LEAVE
        </button>
        <div className="flex items-center gap-2">
          <ShopButton compact />
          <MuteButton />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-y-auto px-3 pb-3 short:px-2 short:pb-2">
        <div className="panel anim-rise pointer-events-auto m-auto w-full max-w-md p-5 sm:p-7 short:max-w-2xl short:p-4">
          <div className="text-center">
            <div className="display text-3xl text-white sm:text-4xl short:hidden">DROPZONE</div>
            <div className="mt-3 text-[11px] font-bold tracking-[0.35em] text-white/60 short:mt-0">ROOM CODE</div>
            <div className="mt-1 font-mono text-[44px] font-black tracking-[0.3em] text-brand-2 sm:text-[56px] short:text-[36px]">{roomCode}</div>
            <div className="mt-3 flex justify-center gap-2 short:mt-2">
              <button className="btn btn-secondary min-h-12 px-5 text-sm" onClick={copy}>
                {copied ? "COPIED ✓" : "COPY CODE"}
              </button>
              <button className="btn btn-accent min-h-12 px-5 text-sm" onClick={share}>
                SHARE
              </button>
            </div>
            {offline && <p className="mt-3 text-[11px] font-bold text-brand-2">LOCAL MODE — other tabs on this device can join. Add Supabase keys for online play.</p>}
          </div>

          <div className="mt-4 text-xs font-bold tracking-widest text-white/70 short:mt-2">GAME MODE {!isHost && <span className="text-white/40">(host picks)</span>}</div>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
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
                  className={`rounded-xl border-2 px-2 py-2 text-left transition ${active ? "border-brand-2 bg-brand-2/15" : "border-white/10 bg-white/5"} ${isHost ? "active:scale-95" : "cursor-default"}`}
                >
                  <div className="text-lg leading-none">{meta.icon}</div>
                  <div className={`mt-1 text-[12px] font-black leading-tight ${active ? "text-brand-2" : "text-white"}`}>{meta.name}</div>
                  <div className="text-[9px] font-bold tracking-wider text-white/50">{meta.tagline}</div>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-center text-[11px] font-semibold text-white/60 short:hidden">{GAME_MODES[mode].description}</p>
          <button
            disabled={!isHost || roundInProgress}
            onClick={() => {
              sound.play("click");
              setPartyMix(!partyMix);
            }}
            className={`mt-2 flex w-full items-center justify-between rounded-xl border-2 px-3 py-1.5 text-[11px] font-black tracking-widest ${partyMix ? "border-brand-2 bg-brand-2/15 text-brand-2" : "border-white/10 bg-white/5 text-white/70"} ${isHost ? "active:scale-[0.98]" : "cursor-default"}`}
          >
            <span>🎲 PARTY MIX — rotate modes every round</span>
            <span>{partyMix ? "ON" : "OFF"}</span>
          </button>
          {seriesRows.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-white/80">
              <span className="text-white/50">SERIES</span>
              {seriesRows.map((p) => (
                <span key={p.id} className="rounded-full bg-white/10 px-2 py-0.5">
                  {p.nickname} <span className="text-brand-2">{series[p.id]}</span>
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-xs font-bold tracking-widest text-white/70 short:mt-2">
            <span>PLAYERS</span>
            <span>
              {players.length} / {MAX_PLAYERS}
            </span>
          </div>
          <ul className="mt-2 grid max-h-32 grid-cols-2 gap-2 overflow-y-auto pr-1 short:grid-cols-4">
            {players.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2">
                <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: p.colorHex, boxShadow: `0 0 10px ${p.colorHex}` }} />
                <span className="truncate text-sm font-bold text-white">
                  {p.nickname}
                  {p.id === localId && <span className="text-white/50"> (you)</span>}
                </span>
                <span className="rounded-full bg-white/10 px-1.5 text-[9px] font-black text-brand-2">LV{p.level ?? 1}</span>
                {p.isHost && <span className="ml-auto text-[10px] font-black text-brand-2">HOST</span>}
              </li>
            ))}
            {Array.from({ length: Math.max(0, Math.min(MAX_PLAYERS, 2) - players.length) }).map((_, i) => (
              <li key={`empty-${i}`} className="flex items-center gap-2 rounded-xl border border-dashed border-white/15 px-3 py-2 text-sm font-semibold text-white/30">
                waiting…
              </li>
            ))}
          </ul>

          <div className="mt-5 short:mt-3">
            {roundInProgress ? (
              <div className="rounded-2xl bg-white/10 p-3 text-center text-sm font-bold text-white/80">A round is in progress — you&apos;ll join the next one.</div>
            ) : isHost ? (
              <button className="btn btn-primary w-full text-xl" disabled={!canStart} onClick={() => { sound.play("click"); startGame(); }}>
                START GAME
              </button>
            ) : (
              <div className="anim-pulse rounded-2xl bg-white/10 p-3 text-center text-sm font-bold text-white/80">Waiting for the host to start…</div>
            )}
            {isHost && mode === "BOSS" && players.length < 2 && !roundInProgress && (
              <p className="mt-2 text-center text-[11px] font-semibold text-brand-2">1 vs ALL needs at least 2 players — starting solo just lets you try the boss.</p>
            )}
            {isHost && players.length < 2 && !roundInProgress && mode !== "BOSS" && (
              <p className="mt-2 text-center text-[11px] font-semibold text-white/55 short:hidden">Share the code — it&apos;s way more fun with friends. You can start solo to practice.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
