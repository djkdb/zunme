import { RoundedBoxGeometry } from "three-stdlib";

const cache = new Map<string, RoundedBoxGeometry>();

/** Shared rounded-box geometry for tiles (bevelled edges catch the light nicely). */
export function roundedTile(w: number, h: number, d: number, radius = 0.12): RoundedBoxGeometry {
  const key = `${w}:${h}:${d}:${radius}`;
  let g = cache.get(key);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, 2, radius);
    cache.set(key, g);
  }
  return g;
}
