import { NICKNAME_MAX_LENGTH, PLAYER_COLORS, ROOM_CODE_LENGTH } from "@/game/config";
import type { PlayerPresence } from "@/types";

// No ambiguous glyphs (0/O, 1/I) so codes are easy to read aloud.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(): string {
  let code = "";
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return code;
}

export function normalizeRoomCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH);
}

export function isValidRoomCode(code: string): boolean {
  return code.length === ROOM_CODE_LENGTH && /^[A-Z0-9]+$/.test(code);
}

export function generatePlayerId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

const ADJECTIVES = ["재빠른", "통통", "흔들", "터보", "살금", "힘센", "쌩쌩", "행운의", "야생", "우주"];
const NOUNS = ["콩", "젤리", "로켓", "피클", "혜성", "수달", "망고", "닌자", "예티", "판다"];

export function randomNickname(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${a}${n}`.slice(0, NICKNAME_MAX_LENGTH);
}

export function sanitizeNickname(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ").slice(0, NICKNAME_MAX_LENGTH);
  return trimmed.length > 0 ? trimmed : randomNickname();
}

/** Deterministic host election: earliest join wins, id breaks ties. */
export function sortPlayers(players: PlayerPresence[]): PlayerPresence[] {
  return [...players].sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
}

export function electHost(players: PlayerPresence[]): string | null {
  const sorted = sortPlayers(players);
  return sorted[0]?.id ?? null;
}

/** Pick the first color not taken by anyone else in the room. */
export function pickFreeColor(taken: number[]): number {
  for (let i = 0; i < PLAYER_COLORS.length; i++) if (!taken.includes(i)) return i;
  return Math.floor(Math.random() * PLAYER_COLORS.length);
}

export function roomShareUrl(code: string): string {
  if (typeof window === "undefined") return `/room/${code}`;
  return `${window.location.origin}/room/${code}`;
}

/** Local identity persisted so a page refresh keeps the same nickname. */
export function loadIdentity(): { id: string; nickname: string } {
  let id = "";
  let nickname = "";
  try {
    id = sessionStorage.getItem("dropzone:id") ?? "";
    nickname = localStorage.getItem("dropzone:nickname") ?? "";
  } catch {
    /* storage unavailable */
  }
  if (!id) {
    id = generatePlayerId();
    try {
      sessionStorage.setItem("dropzone:id", id);
    } catch {
      /* ignore */
    }
  }
  if (!nickname) nickname = randomNickname();
  return { id, nickname };
}

export function saveNickname(nickname: string) {
  try {
    localStorage.setItem("dropzone:nickname", nickname);
  } catch {
    /* ignore */
  }
}
