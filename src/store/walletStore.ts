"use client";

/**
 * Local wallet: points, owned cosmetics, equipped set. There are no
 * accounts, so it lives in localStorage (per browser) and the equipped
 * set is shared with other players through presence.
 */
import { create } from "zustand";
import { levelFromXp } from "@/game/progression";
import {
  DEFAULT_COSMETICS,
  FREE_ITEMS,
  STARTER_ITEMS,
  STARTING_POINTS,
  itemById,
  sanitizeCosmetics,
  type Cosmetics,
  type CosmeticSlot,
} from "@/game/items";

const KEY = "dropzone:wallet";

/** Current XP from the progress store's storage (avoids a circular import). */
function loadXp(): number {
  try {
    const raw = localStorage.getItem("dropzone:progress");
    return raw ? Math.max(0, Number((JSON.parse(raw) as { xp?: number }).xp) || 0) : 0;
  } catch {
    return 0;
  }
}

interface Persisted {
  points: number;
  owned: string[];
  equipped: Cosmetics;
  claimed: string[];
  lifetime: number;
}

interface WalletStore extends Persisted {
  /** most recent reward, for the result screen */
  lastReward: { key: string; points: number; rank: number } | null;
  buy(itemId: string): boolean;
  equip(itemId: string): void;
  claimReward(key: string, points: number, rank: number): boolean;
}

function load(): Persisted {
  const starter = STARTER_ITEMS[Math.floor(Math.random() * STARTER_ITEMS.length)];
  const fresh: Persisted = {
    points: STARTING_POINTS,
    owned: [...FREE_ITEMS, starter],
    equipped: { ...DEFAULT_COSMETICS, [itemById(starter)!.slot]: starter },
    claimed: [],
    lifetime: 0,
  };
  if (typeof window === "undefined") return fresh;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(fresh));
      return fresh;
    }
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    const owned = Array.from(new Set([...FREE_ITEMS, ...(Array.isArray(parsed.owned) ? parsed.owned.filter((id) => itemById(id)) : [])]));
    const equipped = sanitizeCosmetics(parsed.equipped);
    for (const slot of Object.keys(equipped) as CosmeticSlot[]) if (!owned.includes(equipped[slot])) equipped[slot] = DEFAULT_COSMETICS[slot];
    return {
      points: Math.max(0, Math.floor(Number(parsed.points) || 0)),
      owned,
      equipped,
      claimed: Array.isArray(parsed.claimed) ? parsed.claimed.slice(-50) : [],
      lifetime: Math.max(0, Math.floor(Number(parsed.lifetime) || 0)),
    };
  } catch {
    return fresh;
  }
}

function save(p: Persisted) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}

const initial = load();

/** Re-read storage (another tab may have changed it) and mirror it into the store. */
function sync(set: (p: Partial<WalletStore>) => void): Persisted {
  const cur = load();
  set(cur);
  return cur;
}

export const useWalletStore = create<WalletStore>((set) => ({
  ...initial,
  lastReward: null,

  buy(itemId) {
    const item = itemById(itemId);
    const cur = sync(set);
    if (!item || cur.owned.includes(itemId) || cur.points < item.price) return false;
    if (item.minLevel && levelFromXp(loadXp()).level < item.minLevel) return false;
    const next: Persisted = { ...cur, points: cur.points - item.price, owned: [...cur.owned, itemId] };
    set(next);
    save(next);
    return true;
  },

  equip(itemId) {
    const item = itemById(itemId);
    const cur = sync(set);
    if (!item || !cur.owned.includes(itemId)) return;
    const next: Persisted = { ...cur, equipped: { ...cur.equipped, [item.slot]: itemId } };
    set(next);
    save(next);
  },

  claimReward(key, points, rank) {
    const cur = sync(set);
    if (cur.claimed.includes(key)) return false;
    const next: Persisted = {
      ...cur,
      points: cur.points + points,
      lifetime: cur.lifetime + points,
      claimed: [...cur.claimed, key].slice(-50),
    };
    set({ ...next, lastReward: { key, points, rank } });
    save(next);
    return true;
  },
}));
