/**
 * Central game configuration. Every tunable constant lives here so that
 * gameplay feel can be adjusted without touching component code.
 */

export const GAME_NAME = "ZUUUN";

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
export const DEFAULT_SERIES_TOTAL = 5; // Best of 5
export const SERIES_CHAMPION_BONUS = 150; // points once per series for the champion
export const SERIES_FINISH_BONUS = 40; // everyone else who played the whole series
export const ELIMINATION_SLOWMO_DURATION = 700;
export const ELIMINATION_SLOWMO_SCALE = 0.3;

// ── Game modes ──────────────────────────────────────────────────────
export const GAME_MODES = {
  SUMO: {
    name: "드롭존",
    tagline: "최후의 1인",
    description: "섬 밖으로 전부 밀어내세요. 떨어지면 탈락. 마지막까지 남으면 승리.",
    icon: "🥊",
    duration: 65_000,
    suddenDeath: 30_000,
    minPlayers: 1,
  },
  RACE: {
    name: "스카이 대시",
    tagline: "결승선 선착순",
    description: "문, 컨베이어, 해머, 바람까지 12구간 장애물 레이스. 떨어지면 마지막 체크포인트에서 다시 시작.",
    icon: "🏁",
    duration: 150_000,
    suddenDeath: 0,
    minPlayers: 1,
  },
  MELTDOWN: {
    name: "멜트다운",
    tagline: "멈추면 끝",
    description: "밟은 타일이 곧바로 사라집니다. 점점 좁아지는 3개 층. 마지막 생존자가 승리.",
    icon: "🔥",
    duration: 75_000,
    suddenDeath: 0,
    minPlayers: 1,
  },
  BOSS: {
    name: "보스전",
    tagline: "1 vs 전원",
    description: "한 명이 보스가 됩니다. 더 크고 무겁고 강하게 칩니다. 나머지는 힘을 합쳐 시간 안에 보스를 떨어뜨리세요. 보스는 매 라운드 바뀝니다.",
    icon: "⚔️",
    duration: 60_000,
    suddenDeath: 0,
    minPlayers: 2,
  },
  GOGUN: {
    name: "루프탑 러너",
    tagline: "옥상 와이어 액션",
    description: "6스테이지 옥상 달리기, 스테이지마다 빨라집니다. 탭으로 점프, 공중에서 탭하면 와이어를 걸고 스윙. 코인을 모으고 떨어지지 마세요.",
    icon: "🐱",
    duration: 150_000,
    suddenDeath: 0,
    minPlayers: 1,
  },
  TAG: {
    name: "감염",
    tagline: "닿으면 감염",
    description: "한 명이 감염자로 시작합니다. 닿으면 전염되고, 떨어져도 감염됩니다. 시간이 끝나면 생존자 승리, 전원 감염되면 최초 감염자 승리.",
    icon: "🧟",
    duration: 60_000,
    suddenDeath: 0,
    minPlayers: 2,
  },
  BOMB: {
    name: "폭탄 돌리기",
    tagline: "폭탄을 넘겨라",
    description: "누군가 짧은 퓨즈의 폭탄을 들고 있습니다. 다른 플레이어에게 닿으면 넘어갑니다. 터지면 보유자 탈락, 새 폭탄 등장. 마지막까지 남으면 승리.",
    icon: "💣",
    duration: 90_000,
    suddenDeath: 0,
    minPlayers: 2,
  },
  HILL: {
    name: "언덕의 왕",
    tagline: "중앙을 지켜라",
    description: "가운데 언덕 위에 서 있으면 점수가 쌓입니다. 다른 사람은 밀어내세요. 떨어져도 시간만 잃습니다. 언덕 위 시간이 가장 긴 사람이 승리.",
    icon: "⛰️",
    duration: 60_000,
    suddenDeath: 0,
    minPlayers: 1,
  },
  COIN: {
    name: "코인 러시",
    tagline: "전부 주워라",
    description: "코인이 웨이브로 쏟아집니다. 금화는 3점. 경쟁자를 밀어내고 주우세요. 합계가 가장 높은 사람이 승리.",
    icon: "🪙",
    duration: 60_000,
    suddenDeath: 0,
    minPlayers: 1,
  },
  COLOR: {
    name: "컬러 패닉",
    tagline: "그 색 위에 서라",
    description: "색이 호출되면 나머지 타일이 전부 떨어집니다. 그 전에 맞는 색 위로 가세요. 점점 빨라집니다. 마지막 생존자가 승리.",
    icon: "🎨",
    duration: 75_000,
    suddenDeath: 0,
    minPlayers: 1,
  },
  WALLS: {
    name: "벽 뚫기",
    tagline: "틈을 찾아라",
    description: "구멍 난 벽이 발판을 쓸고 지나갑니다. 점점 빨라집니다. 틈으로 빠져나가지 못하면 밀려 떨어집니다.",
    icon: "🧱",
    duration: 75_000,
    suddenDeath: 0,
    minPlayers: 1,
  },
  TIPTOE: {
    name: "살금살금",
    tagline: "아무것도 믿지 마",
    description: "가짜 타일 속에 숨은 길. 가짜를 밟으면 떨어집니다. 밟아서 드러난 타일은 모두에게 보입니다. 남이 길을 찾게 두거나, 앞장서세요.",
    icon: "👣",
    duration: 90_000,
    suddenDeath: 0,
    minPlayers: 1,
  },
  TOWER: {
    name: "용암 탈출",
    tagline: "오르거나 타거나",
    description: "나선형 탑을 따라 용암이 차오릅니다. 발판을 뛰어 올라 정상까지. 먼저 정상에 닿으면 승리.",
    icon: "🌋",
    duration: 90_000,
    suddenDeath: 0,
    minPlayers: 1,
  },
  SPIN: {
    name: "회전 지옥",
    tagline: "막대를 뛰어넘어라",
    description: "작은 원판 위, 높이가 다른 역회전 막대 2개가 점점 빨라집니다. 타이밍을 맞춰 점프. 마지막까지 원판에 남으면 승리.",
    icon: "🌀",
    duration: 75_000,
    suddenDeath: 0,
    minPlayers: 1,
  },
  CROWN: {
    name: "왕관 쟁탈",
    tagline: "잡고 도망쳐",
    description: "왕관을 잡고 도망치세요. 닿는 사람이 뺏어갑니다. 떨어지면 왕관은 중앙으로 돌아갑니다. 왕관 착용 시간 합계가 가장 긴 사람이 승리.",
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
export const COLOR_FIRST_GRACE = 4_000; // extra roam time before the very first call
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
export const PLAYER_ACCEL = 42; // m/s^2 towards target velocity
export const PLAYER_DECEL = 60; // m/s^2 when letting go (stops crisply)
export const PLAYER_TURN_ACCEL = 75; // m/s^2 when reversing direction (snappy turns)
export const PLAYER_IDLE_FRICTION = 0.88; // per 1/60 s while idle on the ground
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
export const DASH_HIT_STUN_MS = 420; // victim of a dash hit
export const DASH_HIT_MULTIPLIER = 1.35; // extra knockback when the attacker is dashing
export const HITSTOP_MS = 70; // freeze frame on a dash hit
export const HITSTOP_SCALE = 0.12;
export const KNOCKOUT_CREDIT_MS = 5000; // a fall within this after a hit credits the hitter

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
export const NET_BURST_RATE = 30; // Hz while dashing / just hit, so fast moves land on every screen
export const NET_BURST_AFTER_MS = 350;
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
  land: "/sounds/land.mp3",
  impact: "/sounds/impact.mp3",
  heavy: "/sounds/heavy.mp3",
  elimination: "/sounds/elimination.mp3",
  win: "/sounds/win.mp3",
  dash: "/sounds/dash.mp3",
  warning: "/sounds/warning.mp3",
  coin: "/sounds/coin.mp3",
  checkpoint: "/sounds/checkpoint.mp3",
  tick: "/sounds/tick.mp3",
  final: "/sounds/final.mp3",
  emote: "/sounds/emote.mp3",
} as const;

export type SoundName = keyof typeof SOUND_PATHS;
