# DROPZONE — Last One Standing

A mobile-first 3D multiplayer browser game. Up to 8 friends drop onto a
floating island, shove each other around, dodge a spinning bar, a sweeping
wall and collapsing tiles — the last one standing wins. Share a 6-letter
room code and play instantly, no accounts.

Built with **Next.js 16 · TypeScript · React Three Fiber · Drei · Rapier ·
Cloudflare Durable Objects (realtime) · Tailwind CSS · Zustand**. Supabase
Realtime and Neon (match history) are optional plug-ins.

## Quick start

```bash
npm install
cp .env.example .env.local   # add your Supabase URL + anon key (optional)
npm run dev                  # http://localhost:3000
```

```bash
npm run build   # production build
npm run lint    # eslint
```

`npm run dev` runs in **local mode**: other tabs on the same device can join
a room (handy for testing), otherwise it is solo practice. Production builds
talk to the bundled Cloudflare Durable Object over WebSocket (`/ws`), so the
deployed game is multiplayer out of the box. Supabase Realtime can be used
instead by setting its env vars (see [`supabase/README.md`](supabase/README.md)).

## Deploy

See [`DEPLOY.md`](DEPLOY.md): `npm run preview` runs the Worker + Durable
Object locally, `npm run deploy` ships it. Optional Neon match history via
`neon/schema.sql` + a `DATABASE_URL` secret.

## Controls

| Platform | Move | Jump |
| --- | --- | --- |
| PC | `W A S D` / arrows | `Space` |
| Mobile | floating joystick (left half) | `JUMP` button |

## How a round works

`LOBBY → 3 · 2 · 1 · GO! → PLAYING → (eliminations) → FINISHED`

- Falling below the island eliminates you. Last survivor wins.
- 75 s main round, then **sudden death**: the outer tiles fall away
  permanently and obstacles speed up until one player remains.
- The result screen shows the winner, survival time, ranking, elimination
  order and a share button (Web Share API with clipboard fallback).

## Architecture

```
src/
  app/                  routes (/ and /room/[code])
  components/
    game/               Three.js scene: Arena, Obstacles, Character,
                        LocalPlayer, RemotePlayer, CameraController,
                        Particles, Environment, EffectsDirector
    hud/                HUD, Countdown, EliminationBanner, ResultScreen,
                        MobileControls, LandscapeHint
    lobby/ menu/        Lobby, RoomView, MainMenu
  game/
    config.ts           every tunable constant (speeds, timers, radii…)
    authority.ts        GameAuthority — the rules engine (pure, no React/3D)
    arena.ts            tile layout + seeded obstacle/collapse schedules
    input.ts            keyboard + joystick → single input state
    effects.ts          shake / particle / slow-motion event bus
    audio.ts            sound manager (files with synth fallback)
    remote.ts           snapshot buffers + interpolation for remote players
  lib/
    realtime.ts         backend selection (Supabase → Worker WebSocket → local)
    supabase.ts         client factory (env-based)
    transport.ts        Transport interface: Supabase / Worker WebSocket / Local
    multiplayer.ts      RoomClient: presence, host election, state mirror
    room.ts             room codes, nicknames, colours
  store/gameStore.ts    Zustand store for slowly-changing game/UI state
worker/
  index.ts              Cloudflare Worker entry: /ws → RoomObject, else Next.js
  room-object.ts        Durable Object: presence + broadcast relay per room (+ Neon)
neon/schema.sql         optional match-history table
```

### Networking model

- The earliest-joined player is the **host** and runs `GameAuthority`. It
  owns the countdown, start time, eliminations and the winner, and
  broadcasts the full `GameState` on every change plus a 1 Hz heartbeat.
- Every client simulates its own character with Rapier and broadcasts a
  compact transform snapshot at 15 Hz; remote players are kinematic bodies
  interpolated ~120 ms behind, so shoving is physical on every screen.
- Obstacles and collapsing tiles are derived deterministically from the
  round seed + host-synchronised clock, so nothing about them is networked.
- If the host disconnects, the next player takes over the last known state
  automatically. `GameAuthority` has no React/Three/network imports so it
  can move to a real server later without changes.

## Sounds

`src/game/config.ts` lists the expected files under `public/sounds/`
(`click, countdown, go, jump, impact, elimination, win`). Drop in your own
`.mp3` files and set `USE_SOUND_FILES = true`; until then short synthesized
cues are used. Audio unlocks on the first tap/keypress.
