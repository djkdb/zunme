/**
 * Unified input state. Keyboard (WASD/arrows/space) and the virtual
 * joystick both write into this singleton; the physics loop reads it
 * every frame without going through React state.
 */
export interface InputState {
  /** -1..1, +x = right */
  moveX: number;
  /** -1..1, +y = forward (away from camera) */
  moveY: number;
  jump: boolean;
  /** consumed by the player controller once per press */
  jumpPressed: boolean;
  /** true while the jump key/button is held */
  jumpHeld: boolean;
}

const keys = new Set<string>();
const joystick = { x: 0, y: 0, active: false };
let jumpHeld = false;
let jumpQueued = false;
let dashQueued = false;
/** performance.now() of the last jump press, for jump buffering */
export let lastJumpPressAt = 0;

export const input: InputState = {
  moveX: 0,
  moveY: 0,
  jump: false,
  jumpPressed: false,
  jumpHeld: false,
};

function recompute() {
  let x = 0;
  let y = 0;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
  if (keys.has("KeyW") || keys.has("ArrowUp")) y += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) y -= 1;
  if (joystick.active) {
    x = joystick.x;
    y = joystick.y;
  }
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  input.moveX = x;
  input.moveY = y;
  input.jump = keys.has("Space") || jumpHeld;
  input.jumpHeld = input.jump;
}

let listenersAttached = false;

export function attachKeyboard(): () => void {
  if (typeof window === "undefined" || listenersAttached) return () => {};
  listenersAttached = true;
  const down = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (
      ["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight", "KeyK"].includes(e.code)
    ) {
      e.preventDefault();
    }
    keys.add(e.code);
    if (e.code === "Space") {
      jumpQueued = true;
      lastJumpPressAt = performance.now();
    }
    if (e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyK") dashQueued = true;
    recompute();
  };
  const up = (e: KeyboardEvent) => {
    keys.delete(e.code);
    recompute();
  };
  const blur = () => {
    keys.clear();
    recompute();
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
    listenersAttached = false;
  };
}

export function setJoystick(x: number, y: number, active: boolean) {
  joystick.x = x;
  joystick.y = y;
  joystick.active = active;
  recompute();
}

export function setJumpButton(held: boolean) {
  if (held && !jumpHeld) {
    jumpQueued = true;
    lastJumpPressAt = performance.now();
  }
  jumpHeld = held;
  recompute();
}

export function pressDash() {
  dashQueued = true;
}

/** Returns true once per dash press. */
export function consumeDash(): boolean {
  if (dashQueued) {
    dashQueued = false;
    return true;
  }
  return false;
}

/** Returns true once per jump press. */
export function consumeJump(): boolean {
  if (jumpQueued) {
    jumpQueued = false;
    return true;
  }
  return false;
}

export function resetInput() {
  keys.clear();
  joystick.active = false;
  joystick.x = 0;
  joystick.y = 0;
  jumpHeld = false;
  jumpQueued = false;
  dashQueued = false;
  recompute();
}
