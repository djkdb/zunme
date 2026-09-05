# DROPZONE — Last One Standing

A mobile-first 3D multiplayer party game in the browser. Up to 8 friends,
three Fall Guys-style modes, one 6-letter room code, no accounts:

| Mode | Goal |
| --- | --- |
| 🥊 **DROPZONE** | Sumo island: shove everyone off, dodge the spinner, the sweeper and collapsing tiles. Last one standing wins. |
| 🏁 **SKY DASH** | A 280 m, 12-section obstacle race: spinner alley, stepping stones, a door-dash wall (two of four doors are fake), conveyor belts that push you toward the gaps, pendulum hammers, a crumbling bridge, a jump-pad gap, sweepers with side pistons, a crosswind fan bridge and a triple-spinner finale. Five checkpoints; falling respawns you at the last one. First across the line wins. |
| 🔥 **MELTDOWN** | Three shrinking floors of tiles that vanish right after you step on them. Keep moving. Last survivor wins. |

Every player is a variation of the ZUN character (navy "ZUN" cap, hoodie in
the player colour, sneakers) dressed up from the **ZUN Shop**.

## Points & shop

Rounds pay out points by placement (1st +120 · 2nd +90 · 3rd +70 · others
+50, race finishers +30, solo practice pays half). Points buy cosmetics
only — hats (beanie, party hat, cat ears, halo, crown, coloured caps), face
items (sunglasses, glasses, visor, headphones), back items (backpack, scarf,
cape, jetpack, wings) and running trails (sparkle, hearts, fire, rainbow).
Nothing affects gameplay. The wallet lives in the browser's localStorage
(there are no accounts) and equipped items travel with presence, so everyone
in the room sees your outfit. Catalogue and prices: `src/game/items.ts`;
payout rules: `src/game/rewards.ts`.

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

`LOBBY (host picks a mode) → 3 · 2 · 1 · GO! → PLAYING → FINISHED`

- DROPZONE: falling eliminates you. 75 s, then **sudden death** — outer
  tiles fall away permanently and obstacles speed up until one remains.
- SKY DASH: 150 s. Once someone finishes, everyone else has 15 s to cross.
  Ranking = finish order, then checkpoint progress. Fake doors, tile
  crumbles and obstacle timing are seeded per round, so every client agrees.
- MELTDOWN: 75 s. Tiles vanish 0.45 s after being stepped on (synced to all
  players); floors 2 and 3 are smaller, then it's the lava.
- The result screen shows the winner, survival time, ranking, elimination
  order and a share button (Web Share API with clipboard fallback).

## Architecture

```
src/
  app/                  routes (/ and /room/[code])
  components/
    game/               Three.js scene: Arena, RaceCourse + RaceObstacles
                        (doors, belts, hammers, crumble, jump pad, fans,
                        pistons), MeltdownArena, Obstacles (Spinner/Sweeper),
                        Character (ZUN chibi),
                        LocalPlayer, RemotePlayer, CameraController,
                        Particles, Environment, EffectsDirector
    hud/                HUD, Countdown, EliminationBanner, ResultScreen,
                        MobileControls, LandscapeHint
    lobby/ menu/        Lobby, RoomView, MainMenu
  game/
    config.ts           every tunable constant + GAME_MODES metadata
    authority.ts        GameAuthority — the rules engine (pure, no React/3D)
    arena.ts            sumo island layout + seeded collapse schedules
    race.ts             SKY DASH course data (platforms, obstacles, checkpoints)
    meltdown.ts         MELTDOWN floor layout
    sync.ts             peer gameplay events (tile vanish) + race runtime
    items.ts            cosmetic catalogue (hats, face, back, trails)
    rewards.ts          points per placement
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
  components/shop/      Shop modal, 3D turntable preview, points button
  store/gameStore.ts    Zustand store for slowly-changing game/UI state
  store/walletStore.ts  points / owned / equipped, persisted in localStorage
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
