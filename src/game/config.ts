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

// ── Game modes ──────────────────────────────────────────────────────
export const GAME_MODES = {
  SUMO: {
    name: "DROPZONE",
    tagline: "LAST ONE STANDING",
    description: "Shove everyone off the island. Fall = out. Last survivor wins.",
    icon: "🥊",
    duration: 65_000,
    suddenDeath: 30_000,
    minPlayers: 1,
  },
  RACE: {
    name: "SKY DASH",
    tagline: "FIRST TO THE FINISH",
    description: "12 sections of doors, belts, hammers, wind and worse. Fall and you respawn at the last checkpoint.",
    icon: "🏁",
    duration: 150_000,
    suddenDeath: 0,
    minPlayers: 1,
  },
  MELTDOWN: {
    name: "MELTDOWN",
    tagline: "KEEP MOVING",
    description: "Tiles vanish right after you step on them. Three floors, each smaller. Last survivor wins.",
    icon: "🔥",
    duration: 75_000,
    suddenDeath: 0,
    minPlayers: 1,
  },
  BOSS: {
    name: "1 vs ALL",
    tagline: "BOSS BRAWL",
    description: "One player is the BOSS: bigger, heavier, harder-hitting. Everyone else teams up to shove them off before time runs out. Boss rotates every round.",
    icon: "⚔️",
    duration: 60_000,
    suddenDeath: 0,
    minPlayers: 2,
  },
  GOGUN: {
    name: "GOGUN RUN",
    tagline: "ROOFTOP WIRE ACTION",
    description: "Six stages of rooftops, faster every stage. Tap to jump, tap in the air to hook a wire and swing. Grab coins, don't fall.",
    icon: "🐱",
    duration: 150_000,
    suddenDeath: 0,
    minPlayers: 1,
  },
  TAG: {
    name: "INFECTION",
    tagline: "DON'T GET TOUCHED",
    description: "One player starts infected. A touch spreads it. Fall off and you turn too. Survivors win when time runs out — if everyone turns, patient zero wins.",
    icon: "🧟",
    duration: 60_000,
    suddenDeath: 0,
    minPlayers: 2,
  },
  BOMB: {
    name: "HOT POTATO",
    tagline: "PASS THE BOMB",
    description: "Someone is holding a bomb with a short fuse. Touch another player to pass it. When it blows, the holder is out and a new bomb appears. Last one standing wins.",
    icon: "💣",
    duration: 90_000,
    suddenDeath: 0,
    minPlayers: 2,
  },
  HILL: {
    name: "HILL KING",
    tagline: "HOLD THE CENTRE",
    description: "Stand on the hill in the middle to score. Shove everyone else off it. Falling only costs you time. Most seconds on the hill wins.",
    icon: "⛰️",
    duration: 60_000,
    suddenDeath: 0,
    minPlayers: 1,
  },
  COIN: {
    name: "COIN FRENZY",
    tagline: "GRAB EVERYTHING",
    description: "Coins rain onto the island in waves. Gold ones are worth three. Shove rivals away from the piles. Highest total wins.",
    icon: "🪙",
    duration: 60_000,
    suddenDeath: 0,
    minPlayers: 1,
  },
  COLOR: {
    name: "COLOR PANIC",
    tagline: "STAND ON THE COLOR",
    description: "A colour is called, then every other tile drops away. Get onto the right colour before it does. Rounds get faster. Last survivor wins.",
    icon: "🎨",
    duration: 75_000,
    suddenDeath: 0,
    minPlayers: 1,
  },
  WALLS: {
    name: "WALL RUSH",
    tagline: "FIND THE GAP",
    description: "Walls with holes sweep across the platform, faster every time. Slip through the gaps or get pushed into the void.",
    icon: "🧱",
    duration: 75_000,
    suddenDeath: 0,
    minPlayers: 1,
  },
  TIPTOE: {
    name: "TIPTOE",
    tagline: "TRUST NOTHING",
    description: "A hidden path across a grid of fake tiles. Step on a fake one and it drops you. Everyone sees what you reveal — let others test the way, or lead.",
    icon: "👣",
    duration: 90_000,
    suddenDeath: 0,
    minPlayers: 1,
  },
  TOWER: {
    name: "LAVA CLIMB",
    tagline: "CLIMB OR BURN",
    description: "Lava rises up a spiral tower. Jump from platform to platform to the top before it catches you. First to the summit wins.",
    icon: "🌋",
    duration: 90_000,
    suddenDeath: 0,
    minPlayers: 1,
  },
  SPIN: {
    name: "SPIN CYCLE",
    tagline: "JUMP THE BARS",
    description: "A tiny disc, counter-rotating bars at two heights, and they keep speeding up. Time your jumps. Last one on the disc wins.",
    icon: "🌀",
    duration: 75_000,
    suddenDeath: 0,
    minPlayers: 1,
  },
  CROWN: {
    name: "CROWN RUSH",
    tagline: "KEEP AWAY",
    description: "Grab the crown and run. Anyone who touches you takes it. Falling drops it back to the centre. Longest total time wearing the crown wins.",
    icon: "👑",
    duration: 60_000,
    suddenDeath: 0,
    minPlayers: 1,
  },
} as const;
export const DEFAULT_MODE = "SUMO" as const;
/** RACE: once someone finishes, everyone else has this long to cross the line. */
export const RACE_FINISH_GRACE = 15_000;
export const RACE_FALL_Y = -8;
export const RACE_JUMP_PAD_VELOCITY = 17;
export const RACE_WIND_SPEED = 3.4; // m/s sideways drift inside a fan zone (counter-steer to survive)
export const RACE_CONVEYOR_SPEED = 7; // m/s
export const MELTDOWN_FALL_Y = -22;
export const MELTDOWN_STEP_DELAY = 450; // ms after stepping before the tile vanishes (at GO!)
export const MELTDOWN_STEP_DELAY_MIN = 200; // ...shrinking to this over MELTDOWN_STEP_RAMP_MS
export const MELTDOWN_STEP_RAMP_MS = 40_000;

// ── Boss (1 vs ALL) ──────────────────────────────────────────────────
export const BOSS_SCALE = 1.35;
export const BOSS_MASS = 3;
export const BOSS_SPEED = 6.8;
export const BOSS_DASH_COOLDOWN = 1000;
export const BOSS_HIT_MULTIPLIER = 1.7; // knockback dealt by the boss
export const BOSS_KNOCKBACK_RESIST = 0.45; // knockback received by the boss

// ── Party modes ──────────────────────────────────────────────────────
export const BOMB_FUSE_START = 11_000; // ms; shrinks after every explosion
export const BOMB_FUSE_MIN = 5_000;
export const BOMB_FUSE_STEP = 1_500;
export const BOMB_PASS_COOLDOWN = 450; // ms before the bomb can be passed back
export const CROWN_STEAL_COOLDOWN = 900;
export const CROWN_PICKUP_RADIUS = 1.4;
export const HILL_RADIUS = 3.2;
export const HILL_HEIGHT = 1.1;
export const SCORE_FLUSH_MS = 400; // host batches HILL / CROWN time into state this often
export const COIN_WAVE_INTERVAL = 9_000;
export const COIN_WAVE_SIZE = 12;
export const COIN_WAVES = 6;
export const COIN_PICKUP_RADIUS = 1.1;
export const COIN_GOLD_POINTS = 3;
export const COLOR_WARN_MS = 2_300;
export const COLOR_DROP_MS = 2_600;
export const COLOR_CYCLE_START = 9_000;
export const COLOR_CYCLE_MIN = 5_200;
export const COLOR_CYCLE_STEP = 450;
export const COLOR_GRID = 11; // tiles per side
export const COLOR_FALL_Y = -8;
export const WALLS_HALF_X = 8;
export const WALLS_HALF_Z = 12;
export const WALLS_INTERVAL_START = 4_200;
export const WALLS_INTERVAL_MIN = 2_100;
export const WALLS_SPEED_START = 5;
export const WALLS_SPEED_MAX = 9.5;
export const WALLS_SLOTS = 5; // wall is split into slots; gaps are missing slots
export const WALLS_FALL_Y = -8;
export const TIPTOE_ROWS = 12;
export const TIPTOE_COLS = 4;
export const TIPTOE_TILE = 2.4;
export const TIPTOE_FALL_Y = -8;
export const TOWER_PLATFORMS = 24;
export const TOWER_STEP_Y = 1.45;
export const TOWER_LAVA_START_Y = -3.5;
export const TOWER_LAVA_SPEED = 0.42; // m/s
export const TOWER_LAVA_DELAY = 3_000; // ms after GO! before it starts rising
export const SPIN_RADIUS = 7.5;
export const SPIN_FALL_Y = -8;

// ── Meteors (DROPZONE) ───────────────────────────────────────────────
export const METEOR_FIRST_AT = 9_000;
export const METEOR_INTERVAL_MIN = 5_000;
export const METEOR_INTERVAL_MAX = 9_000;
export const METEOR_WARNING_MS = 1_500;
export const METEOR_RADIUS = 2.8;
export const METEOR_IMPULSE = 11;

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
export const PUSH_IMPULSE_MAX = 13;
export const PUSH_RELATIVE_FACTOR = 0.6; // extra knockback per m/s of closing speed
export const AIR_HIT_MULTIPLIER = 1.3; // airborne victims fly further
export const HIT_STUN_MS = 250; // no control right after a hard hit
export const OBSTACLE_STUN_MS = 350;

// ── Dash ─────────────────────────────────────────────────────────────
export const DASH_SPEED = 19; // m/s during a dash
export const DASH_DURATION = 220; // ms
export const DASH_COOLDOWN = 1800; // ms
export const DASH_SELF_KNOCKBACK = 0.3; // attacker keeps momentum

// ── Jump feel ────────────────────────────────────────────────────────
export const JUMP_CUT_MULTIPLIER = 0.5; // release early → shorter hop
export const COYOTE_TIME_MS = 120;
export const JUMP_BUFFER_MS = 150;
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
export const TILE_FIRST_COLLAPSE_DELAY = 6000; // grace period after GO!
export const TILE_ACTIVE_RATIO = 0.6; // share of outer tiles that cycle during the round

// ── Obstacles ────────────────────────────────────────────────────────
export const SPINNER_LENGTH = 15;
export const SPINNER_SPEED = 1.0; // rad/s at GO!, ramps up over the round
export const SPINNER_RAMP = 0.7; // +70% speed by the end of the main round
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
  dash: "/sounds/dash.mp3",
  warning: "/sounds/warning.mp3",
} as const;

export type SoundName = keyof typeof SOUND_PATHS;
