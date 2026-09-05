/**
 * MELTDOWN layout: two stacked floors of tiles. A tile vanishes shortly
 * after someone steps on it (see MELTDOWN_STEP_DELAY) and never returns.
 */
import { TILE_SIZE } from "@/game/config";

export interface MeltTile {
  index: number;
  x: number;
  z: number;
}

export const MELTDOWN_RADIUS = 9.6;
export const MELTDOWN_LAYER_Y = [0, -6.5, -13] as const;
export const MELTDOWN_LAYER_RADII = [9.6, 8.2, 6.8] as const;
export const MELTDOWN_LAYER_COLORS = [
  ["#8fe3ff", "#6fd6ff"],
  ["#d3b4ff", "#c199ff"],
  ["#ffb4c8", "#ff9ab8"],
] as const;

function layout(radius: number): MeltTile[] {
  const tiles: MeltTile[] = [];
  const n = Math.ceil(radius / TILE_SIZE) + 1;
  let index = 0;
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const x = i * TILE_SIZE;
      const z = j * TILE_SIZE;
      if (Math.hypot(x, z) <= radius - TILE_SIZE * 0.3) tiles.push({ index: index++, x, z });
    }
  }
  return tiles;
}

/** All layers share one index space (layer 0 layout); smaller layers omit outer tiles. */
export const MELTDOWN_TILES: MeltTile[] = layout(MELTDOWN_RADIUS);
export function tileInLayer(tile: MeltTile, layer: number): boolean {
  return Math.hypot(tile.x, tile.z) <= MELTDOWN_LAYER_RADII[layer] - TILE_SIZE * 0.3;
}

export function meltdownSpawn(index: number, count: number): [number, number, number] {
  const angle = (index / Math.max(1, count)) * Math.PI * 2 + Math.PI / 4;
  return [Math.cos(angle) * 5.5, 2, Math.sin(angle) * 5.5];
}
