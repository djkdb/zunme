# Credits & licences

Everything you see and hear in this game is original work:

- **Graphics**: every arena, obstacle and character is built from primitive
  geometry in code (`src/components/game`). No third-party models, textures
  or sprites are bundled.
- **Audio**: sound effects and background music are synthesised at runtime
  (`src/game/audio.ts`, `src/game/music.ts`). No recorded music ships with
  the game. If you add music files under `public/music`, check their licence
  (see `public/music/README.md`).
- **Characters**: the ZUN character design belongs to the project owner.
- **Game modes**: the modes are original implementations of common party-game
  ideas (sumo, obstacle race, vanishing floors, tag, hot potato, king of the
  hill, colour call-outs, sweeping walls, hidden paths, rising lava, spinning
  bars, keep-away). They reference no other game's names, art, music or
  level layouts.
- **Fonts**: Rubik (SIL Open Font License) via `next/font`; emoji are drawn
  by the player's own device.

## Open-source libraries

| Package | Licence |
| --- | --- |
| next, react, react-dom | MIT |
| three, @react-three/fiber, @react-three/drei, @react-three/postprocessing, postprocessing | MIT |
| @react-three/rapier | MIT (Rapier engine: Apache-2.0) |
| zustand | MIT |
| @supabase/supabase-js, @neondatabase/serverless | MIT / Apache-2.0 |

All of these permit free and commercial use with attribution kept in their
package files (`node_modules/*/LICENSE`).
