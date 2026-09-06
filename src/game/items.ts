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
  /** unlocks at this level (see progression.ts) */
  minLevel?: number;
}

export const SLOT_LABELS: Record<CosmeticSlot, string> = {
  hat: "모자",
  face: "얼굴",
  back: "등",
  trail: "트레일",
};

export const ITEMS: Item[] = [
  // hats
  { id: "cap_zun", slot: "hat", name: "ZUN 캡", price: 0, emoji: "🧢", description: "오리지널 네이비 캡." },
  { id: "cap_red", slot: "hat", name: "빨간 캡", price: 150, emoji: "🟥", description: "같은 캡, 더 튀는 색." },
  { id: "cap_gold", slot: "hat", name: "골드 캡", price: 450, emoji: "🟨", description: "많이 이기는 사람용.", minLevel: 3 },
  { id: "beanie", slot: "hat", name: "비니", price: 250, emoji: "🧶", description: "포근한 니트. 공기역학은 0." },
  { id: "party", slot: "hat", name: "파티 모자", price: 300, emoji: "🥳", description: "오늘은 누군가의 생일." },
  { id: "cat_ears", slot: "hat", name: "고양이 귀", price: 400, emoji: "🐱", description: "냐." },
  { id: "halo", slot: "hat", name: "천사 링", price: 600, emoji: "😇", description: "결백함. 아무도 안 밀었음.", minLevel: 4 },
  { id: "crown", slot: "hat", name: "왕관", price: 900, emoji: "👑", description: "매번 최후의 1인.", minLevel: 6 },
  // face
  { id: "face_none", slot: "face", name: "없음", price: 0, emoji: "🙂", description: "맨얼굴." },
  { id: "sunglasses", slot: "face", name: "선글라스", price: 200, emoji: "🕶️", description: "쿨하게." },
  { id: "glasses", slot: "face", name: "동그란 안경", price: 250, emoji: "👓", description: "클린 코드 에너지." },
  { id: "visor", slot: "face", name: "사이버 바이저", price: 350, emoji: "🥽", description: "스피너가 오는 게 보임.", minLevel: 3 },
  { id: "headphones", slot: "face", name: "헤드폰", price: 300, emoji: "🎧", description: "떨어지면서 듣는 로파이." },
  // back / neck
  { id: "back_none", slot: "back", name: "없음", price: 0, emoji: "🎒", description: "가볍게." },
  { id: "backpack", slot: "back", name: "백팩", price: 150, emoji: "🎒", description: "노트북 포함." },
  { id: "scarf", slot: "back", name: "목도리", price: 200, emoji: "🧣", description: "바람에 펄럭펄럭." },
  { id: "cape", slot: "back", name: "망토", price: 600, emoji: "🦸", description: "망토는 안 된다니까… 하나만." },
  { id: "jetpack", slot: "back", name: "제트팩", price: 750, emoji: "🚀", description: "장식용. 아쉽게도.", minLevel: 5 },
  { id: "wings", slot: "back", name: "날개", price: 950, emoji: "🪽", description: "이것도 장식용. 미안.", minLevel: 8 },
  // trails
  { id: "trail_none", slot: "trail", name: "없음", price: 0, emoji: "✨", description: "흔적 없이." },
  { id: "sparkle", slot: "trail", name: "반짝이", price: 300, emoji: "✨", description: "걸음마다 반짝." },
  { id: "hearts", slot: "trail", name: "하트", price: 400, emoji: "💗", description: "사랑을(그리고 밀치기를) 퍼뜨려요." },
  { id: "fire", slot: "trail", name: "불꽃", price: 550, emoji: "🔥", description: "너무 빠르고 너무 뜨거움.", minLevel: 4 },
  { id: "rainbow", slot: "trail", name: "무지개", price: 800, emoji: "🌈", description: "풀 스펙트럼 플렉스.", minLevel: 7 },
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
