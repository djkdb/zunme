/**
 * Cosmetic item catalogue. Everything here is purely visual — points buy
 * looks, never advantages. Items are rendered by <Character>.
 */
export type CosmeticSlot = "hat" | "face" | "back" | "trail";

export interface Cosmetics {
  hat: string;
  face: string;
  back: string;
  trail: string;
}

export interface Item {
  id: string;
  slot: CosmeticSlot;
  name: string;
  price: number;
  emoji: string;
  description: string;
}

export const SLOT_LABELS: Record<CosmeticSlot, string> = {
  hat: "HATS",
  face: "FACE",
  back: "BACK",
  trail: "TRAILS",
};

export const ITEMS: Item[] = [
  // hats
  { id: "cap_zun", slot: "hat", name: "ZUN Cap", price: 0, emoji: "🧢", description: "The original navy cap." },
  { id: "cap_red", slot: "hat", name: "Red Cap", price: 150, emoji: "🟥", description: "Same cap, louder colour." },
  { id: "cap_gold", slot: "hat", name: "Gold Cap", price: 450, emoji: "🟨", description: "For people who win a lot." },
  { id: "beanie", slot: "hat", name: "Beanie", price: 250, emoji: "🧶", description: "Cosy knit. Zero aerodynamics." },
  { id: "party", slot: "hat", name: "Party Hat", price: 300, emoji: "🥳", description: "It is always someone's birthday." },
  { id: "cat_ears", slot: "hat", name: "Cat Ears", price: 400, emoji: "🐱", description: "Nya." },
  { id: "halo", slot: "hat", name: "Halo", price: 600, emoji: "😇", description: "Innocent. Definitely didn't push anyone." },
  { id: "crown", slot: "hat", name: "Crown", price: 900, emoji: "👑", description: "Last one standing, every time." },
  // face
  { id: "face_none", slot: "face", name: "Nothing", price: 0, emoji: "🙂", description: "Just the face." },
  { id: "sunglasses", slot: "face", name: "Sunglasses", price: 200, emoji: "🕶️", description: "Deal with it." },
  { id: "glasses", slot: "face", name: "Round Glasses", price: 250, emoji: "👓", description: "Clean code energy." },
  { id: "visor", slot: "face", name: "Cyber Visor", price: 350, emoji: "🥽", description: "Sees the spinner coming." },
  { id: "headphones", slot: "face", name: "Headphones", price: 300, emoji: "🎧", description: "Lo-fi beats to fall to." },
  // back / neck
  { id: "back_none", slot: "back", name: "Nothing", price: 0, emoji: "🎒", description: "Travelling light." },
  { id: "backpack", slot: "back", name: "Backpack", price: 150, emoji: "🎒", description: "Laptop included." },
  { id: "scarf", slot: "back", name: "Scarf", price: 200, emoji: "🧣", description: "Flaps in the wind." },
  { id: "cape", slot: "back", name: "Cape", price: 600, emoji: "🦸", description: "No capes! ...one cape." },
  { id: "jetpack", slot: "back", name: "Jetpack", price: 750, emoji: "🚀", description: "Purely decorative. Sadly." },
  { id: "wings", slot: "back", name: "Wings", price: 950, emoji: "🪽", description: "Also decorative. Sorry." },
  // trails
  { id: "trail_none", slot: "trail", name: "Nothing", price: 0, emoji: "✨", description: "Leave no trace." },
  { id: "sparkle", slot: "trail", name: "Sparkle", price: 300, emoji: "✨", description: "Glitter with every step." },
  { id: "hearts", slot: "trail", name: "Hearts", price: 400, emoji: "💗", description: "Spread the love (and shoves)." },
  { id: "fire", slot: "trail", name: "Fire", price: 550, emoji: "🔥", description: "Too fast, too furious." },
  { id: "rainbow", slot: "trail", name: "Rainbow", price: 800, emoji: "🌈", description: "Full spectrum flex." },
];

export const DEFAULT_COSMETICS: Cosmetics = { hat: "cap_zun", face: "face_none", back: "back_none", trail: "trail_none" };
export const FREE_ITEMS = ITEMS.filter((i) => i.price === 0).map((i) => i.id);
/** One of these is granted to every new player so lobbies look varied from day one. */
export const STARTER_ITEMS = ["backpack", "headphones", "sunglasses", "scarf"];
export const STARTING_POINTS = 100;

export const TRAIL_COLORS: Record<string, string[]> = {
  sparkle: ["#ffffff", "#ffd32a", "#fff6c2"],
  hearts: ["#ff6bcb", "#ff9ad5", "#ffffff"],
  fire: ["#ff5a3c", "#ffb020", "#ffd32a"],
  rainbow: ["#ff4757", "#ffd32a", "#2ed573", "#18dcff", "#a55eea"],
};

export function itemById(id: string): Item | undefined {
  return ITEMS.find((i) => i.id === id);
}

export function isValidCosmetics(v: unknown): v is Cosmetics {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (["hat", "face", "back", "trail"] as const).every((slot) => typeof o[slot] === "string" && ITEMS.some((i) => i.id === o[slot] && i.slot === slot));
}

/** Coerce anything from the network into a safe cosmetics object. */
export function sanitizeCosmetics(v: unknown): Cosmetics {
  return isValidCosmetics(v) ? { hat: v.hat, face: v.face, back: v.back, trail: v.trail } : { ...DEFAULT_COSMETICS };
}
