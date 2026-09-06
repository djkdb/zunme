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

export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface Item {
  id: string;
  slot: CosmeticSlot;
  name: string;
  price: number;
  emoji: string;
  description: string;
  /** unlocks at this level (see progression.ts) */
  minLevel?: number;
  /** shows a NEW tag in the shop */
  isNew?: boolean;
}

/** Rarity is derived from price so the catalogue stays a flat list (purely cosmetic). */
export function rarityOf(item: Item): Rarity {
  if (item.price >= 800) return "legendary";
  if (item.price >= 500) return "epic";
  if (item.price >= 300) return "rare";
  return "common";
}

export const RARITY_LABELS: Record<Rarity, { name: string; color: string }> = {
  common: { name: "일반", color: "#9aa3b8" },
  rare: { name: "레어", color: "#3d8bff" },
  epic: { name: "에픽", color: "#a55eea" },
  legendary: { name: "전설", color: "#ffd32a" },
};

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
  { id: "top_hat", slot: "hat", name: "실크햇", price: 350, emoji: "🎩", description: "신사답게 밀칩니다.", isNew: true },
  { id: "hardhat", slot: "hat", name: "안전모", price: 200, emoji: "👷", description: "낙하 시 머리 보호 (기분상).", isNew: true },
  { id: "chef", slot: "hat", name: "요리사 모자", price: 300, emoji: "👨‍🍳", description: "오늘의 메뉴: 뜨거운 감자.", isNew: true },
  { id: "pirate", slot: "hat", name: "해적 모자", price: 500, emoji: "🏴‍☠️", description: "섬은 내 것이다.", minLevel: 4, isNew: true },
  { id: "sprout", slot: "hat", name: "새싹", price: 250, emoji: "🌱", description: "머리에서 자라는 중.", isNew: true },
  // face
  { id: "face_none", slot: "face", name: "없음", price: 0, emoji: "🙂", description: "맨얼굴." },
  { id: "sunglasses", slot: "face", name: "선글라스", price: 200, emoji: "🕶️", description: "쿨하게." },
  { id: "glasses", slot: "face", name: "동그란 안경", price: 250, emoji: "👓", description: "클린 코드 에너지." },
  { id: "visor", slot: "face", name: "사이버 바이저", price: 350, emoji: "🥽", description: "스피너가 오는 게 보임.", minLevel: 3 },
  { id: "headphones", slot: "face", name: "헤드폰", price: 300, emoji: "🎧", description: "떨어지면서 듣는 로파이." },
  { id: "mask", slot: "face", name: "마스크", price: 150, emoji: "😷", description: "익명 보장.", isNew: true },
  { id: "mustache", slot: "face", name: "콧수염", price: 250, emoji: "🥸", description: "아무도 못 알아봄.", isNew: true },
  { id: "glasses_3d", slot: "face", name: "3D 안경", price: 300, emoji: "🎬", description: "낙하가 더 입체적으로.", isNew: true },
  { id: "star_sticker", slot: "face", name: "별 스티커", price: 200, emoji: "⭐", description: "볼에 붙인 오늘의 별.", isNew: true },
  // back / neck
  { id: "back_none", slot: "back", name: "없음", price: 0, emoji: "🎒", description: "가볍게." },
  { id: "backpack", slot: "back", name: "백팩", price: 150, emoji: "🎒", description: "노트북 포함." },
  { id: "scarf", slot: "back", name: "목도리", price: 200, emoji: "🧣", description: "바람에 펄럭펄럭." },
  { id: "cape", slot: "back", name: "망토", price: 600, emoji: "🦸", description: "망토는 안 된다니까… 하나만." },
  { id: "jetpack", slot: "back", name: "제트팩", price: 750, emoji: "🚀", description: "장식용. 아쉽게도.", minLevel: 5 },
  { id: "wings", slot: "back", name: "날개", price: 950, emoji: "🪽", description: "이것도 장식용. 미안.", minLevel: 8 },
  { id: "balloon", slot: "back", name: "풍선", price: 300, emoji: "🎈", description: "떠오르진 않아요. 기분만.", isNew: true },
  { id: "guitar", slot: "back", name: "기타", price: 450, emoji: "🎸", description: "라운드 사이 즉흥 연주.", minLevel: 3, isNew: true },
  { id: "shield", slot: "back", name: "방패", price: 550, emoji: "🛡️", description: "밀치기 방어력 +0 (장식).", minLevel: 5, isNew: true },
  // trails
  { id: "trail_none", slot: "trail", name: "없음", price: 0, emoji: "✨", description: "흔적 없이." },
  { id: "sparkle", slot: "trail", name: "반짝이", price: 300, emoji: "✨", description: "걸음마다 반짝." },
  { id: "hearts", slot: "trail", name: "하트", price: 400, emoji: "💗", description: "사랑을(그리고 밀치기를) 퍼뜨려요." },
  { id: "fire", slot: "trail", name: "불꽃", price: 550, emoji: "🔥", description: "너무 빠르고 너무 뜨거움.", minLevel: 4 },
  { id: "rainbow", slot: "trail", name: "무지개", price: 800, emoji: "🌈", description: "풀 스펙트럼 플렉스.", minLevel: 7 },
  { id: "snow", slot: "trail", name: "눈꽃", price: 350, emoji: "❄️", description: "지나간 자리에 눈이 내려요.", isNew: true },
  { id: "bolt", slot: "trail", name: "번개", price: 500, emoji: "⚡", description: "찌릿찌릿한 발자국.", minLevel: 3, isNew: true },
  { id: "bubbles", slot: "trail", name: "비눗방울", price: 400, emoji: "🫧", description: "톡톡 터지는 걸음.", isNew: true },
  { id: "notes", slot: "trail", name: "음표", price: 450, emoji: "🎵", description: "걸을 때마다 BGM.", minLevel: 2, isNew: true },
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
  snow: ["#ffffff", "#bfe9ff", "#e8f7ff"],
  bolt: ["#ffd32a", "#ffffff", "#18dcff"],
  bubbles: ["#bfefff", "#ffffff", "#c8b6ff"],
  notes: ["#a55eea", "#ff6bcb", "#ffffff"],
};

/** Particle gravity per trail: fire rises, snow and bubbles drift, the rest fall. */
export function trailGravity(trail: string): number {
  if (trail === "fire") return -3;
  if (trail === "snow") return 0.4;
  if (trail === "bubbles") return -0.6;
  return 1.5;
}

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
