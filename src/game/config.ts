/**
 * Central game configuration. Every tunable constant lives here so that
 * gameplay feel can be adjusted without touching component code.
 */

export const GAME_NAME = "DROPZONE";

// ── Room ─────────────────────────────────────────────────────────────
export const MAX_PLAYERS = 8;
export const MIN_PLAYERS_TO_START = 1; // 2 in production; 1 allows solo testing
export const ROOM_CODE_LENGTH = 6;
export const NICKNAME_MAX_LENGTH = 12;

// ── Timing (ms) ──────────────────────────────────────────────────────
export const COUNTDOWN_DURATION = 4000; // 3,2,1,GO!
export const GAME_DURATION = 75_000; // main round
export const SUDDEN_DEATH_DURATION = 30_000; // arena shrinks until one remains
export const RESULT_AUTO_LOBBY_DELAY = 12_000;
export const ELIMINATION_SLOWMO_DURATION = 700;
export const ELIMINATION_SLOWMO_SCALE = 0.3;

// ── Player physics ───────────────────────────────────────────────────
export const PLAYER_SPEED = 7.5; // m/s target ground speed
export const PLAYER_ACCEL = 40; // m/s^2 towards target velocity
export const PLAYER_AIR_CONTROL = 0.45;
export const JUMP_FORCE = 9.2; // initial vertical velocity
export const GRAVITY = -22;
export const PLAYER_MASS = 1;
export const PLAYER_RADIUS = 0.45;
export const PLAYER_HEIGHT = 1.5; // capsule total height
export const PLAYER_LINEAR_DAMPING = 0.4;
export const PUSH_IMPULSE = 4.5; // knockback applied on player-player contact
export const PUSH_IMPULSE_MAX = 9;
export const PUSH_UPWARD = 0.25; // small lift so shoves feel bouncy
export const OBSTACLE_PUSH_IMPULSE = 9;
export const FALL_Y = -6; // below this = eliminated
export const SPAWN_RADIUS = 6;
export const SPAWN_HEIGHT = 2;

// ── Arena ────────────────────────────────────────────────────────────
export const ARENA_RADIUS = 11.5; // ~23m diameter
export const ARENA_HEIGHT = 4;
export const TILE_SIZE = 2.2;
export const COLLAPSIBLE_MIN_RADIUS = 6.5; // tiles further out than this may collapse
export const TILE_WARNING_DURATION = 1500;
export const TILE_COLLAPSE_DURATION = 3500;
export const TILE_CYCLE_MIN = 5000; // idle time between collapses of a tile
export const TILE_CYCLE_MAX = 14000;
export const TILE_FIRST_COLLAPSE_DELAY = 8000; // grace period after GO!

// ── Obstacles ────────────────────────────────────────────────────────
export const SPINNER_LENGTH = 15;
export const SPINNER_SPEED = 0.9; // rad/s
export const SPINNER_HEIGHT = 0.45; // bar bottom height: low enough to jump over
export const SPINNER_START_DELAY = 3000;
export const WALL_TRAVEL = 5; // half travel distance
export const WALL_PERIOD = 6000; // ms for a full back/forth
export const WALL_LENGTH = 5;
export const WALL_Z = -8.6; // sweeps the outer southern ring
export const OBSTACLE_SPEED = 1; // global multiplier, 2 in sudden death

// ── Networking ───────────────────────────────────────────────────────
export const NET_TICK_RATE = 10; // Hz for transform broadcasts (8 players ≈ 80 msg/s, under Supabase's default 100/s quota)
export const NET_INTERPOLATION_DELAY = 150; // ms behind for smooth remote motion (≥ 1 tick)
export const NET_STATE_HEARTBEAT = 1000; // host re-broadcasts state every second
export const PRESENCE_TIMEOUT = 8000; // ms before a silent player is considered gone
export const HOST_LEADERSHIP_GRACE = 1500;

// ── Camera ───────────────────────────────────────────────────────────
export const CAMERA_OFFSET = { x: 0, y: 9.5, z: 13 };
export const CAMERA_LOOK_AHEAD = 1.2;
export const CAMERA_FOLLOW_SMOOTH = 4.5; // higher = snappier
export const CAMERA_ZOOM_MIN = 0.85;
export const CAMERA_ZOOM_MAX = 1.35;
export const CAMERA_FOV = 50;

// ── Colors ───────────────────────────────────────────────────────────
export const PLAYER_COLORS = [
  { name: "RED", hex: "#ff4757" },
  { name: "BLUE", hex: "#3d8bff" },
  { name: "GREEN", hex: "#2ed573" },
  { name: "YELLOW", hex: "#ffd32a" },
  { name: "PURPLE", hex: "#a55eea" },
  { name: "ORANGE", hex: "#ff7f30" },
  { name: "PINK", hex: "#ff6bcb" },
  { name: "CYAN", hex: "#18dcff" },
] as const;

export type PlayerColorName = (typeof PLAYER_COLORS)[number]["name"];

// ── Sound assets ─────────────────────────────────────────────────────
// Drop real files at these paths and flip USE_SOUND_FILES to true; until
// then short synthesized cues are used so every action still has feedback.
export const USE_SOUND_FILES = false;
export const SOUND_PATHS = {
  click: "/sounds/click.mp3",
  countdown: "/sounds/countdown.mp3",
  go: "/sounds/go.mp3",
  jump: "/sounds/jump.mp3",
  impact: "/sounds/impact.mp3",
  elimination: "/sounds/elimination.mp3",
  win: "/sounds/win.mp3",
} as const;

export type SoundName = keyof typeof SOUND_PATHS;
