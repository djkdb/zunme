/**
 * Non-React registries that the render loop reads every frame:
 *  - snapshot buffers for remote players (interpolated NET_INTERPOLATION_DELAY behind)
 *  - the local player's live transform (camera + HUD read it without re-rendering)
 */
import { NET_INTERPOLATION_DELAY } from "@/game/config";
import type { PlayerSnapshot, Vec3 } from "@/types";

export interface InterpolatedPose {
  position: Vec3;
  yaw: number;
  velocity: Vec3;
  grounded: boolean;
  /** ms since the last snapshot arrived (large = stale) */
  age: number;
}

const MAX_BUFFER = 24;

export class SnapshotBuffer {
  private buffer: PlayerSnapshot[] = [];
  private lastReceivedAt = 0;

  push(snap: PlayerSnapshot) {
    this.lastReceivedAt = performance.now();
    // keep sorted by t and drop out-of-order duplicates
    const last = this.buffer[this.buffer.length - 1];
    if (last && snap.t <= last.t) return;
    this.buffer.push(snap);
    if (this.buffer.length > MAX_BUFFER) this.buffer.shift();
  }

  get latest(): PlayerSnapshot | undefined {
    return this.buffer[this.buffer.length - 1];
  }

  sample(hostNow: number, out: InterpolatedPose): boolean {
    const n = this.buffer.length;
    if (n === 0) return false;
    const renderT = hostNow - NET_INTERPOLATION_DELAY;
    out.age = performance.now() - this.lastReceivedAt;

    let a = this.buffer[0];
    let b = this.buffer[n - 1];
    for (let i = n - 1; i >= 0; i--) {
      if (this.buffer[i].t <= renderT) {
        a = this.buffer[i];
        b = this.buffer[Math.min(i + 1, n - 1)];
        break;
      }
    }
    if (a === b || b.t <= a.t) {
      // Extrapolate briefly from the latest snapshot using its velocity
      // (horizontal only when grounded, so nobody sinks through the floor).
      const dt = Math.min(Math.max(0, renderT - b.t), 150) / 1000;
      out.position.x = b.p[0] + b.v[0] * dt;
      out.position.y = b.g ? b.p[1] : Math.max(b.p[1] + b.v[1] * dt, b.p[1] - 1.5);
      out.position.z = b.p[2] + b.v[2] * dt;
      out.yaw = b.r;
      out.velocity.x = b.v[0];
      out.velocity.y = b.v[1];
      out.velocity.z = b.v[2];
      out.grounded = b.g;
      return true;
    }
    const alpha = Math.min(1, Math.max(0, (renderT - a.t) / (b.t - a.t)));
    out.position.x = a.p[0] + (b.p[0] - a.p[0]) * alpha;
    out.position.y = a.p[1] + (b.p[1] - a.p[1]) * alpha;
    out.position.z = a.p[2] + (b.p[2] - a.p[2]) * alpha;
    out.yaw = lerpAngle(a.r, b.r, alpha);
    out.velocity.x = b.v[0];
    out.velocity.y = b.v[1];
    out.velocity.z = b.v[2];
    out.grounded = alpha < 0.5 ? a.g : b.g;
    return true;
  }
}

export function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export const remoteBuffers = new Map<string, SnapshotBuffer>();

export function pushSnapshot(snap: PlayerSnapshot) {
  let buf = remoteBuffers.get(snap.id);
  if (!buf) {
    buf = new SnapshotBuffer();
    remoteBuffers.set(snap.id, buf);
  }
  buf.push(snap);
}

export function clearSnapshots() {
  remoteBuffers.clear();
}

/** Live pose of every player (local + remote) for camera and effects. */
export const livePoses = new Map<string, Vec3>();

export const localPose = {
  position: { x: 0, y: 0, z: 0 } as Vec3,
  yaw: 0,
  velocity: { x: 0, y: 0, z: 0 } as Vec3,
  grounded: false,
  jumpedAt: 0,
  lastImpactAt: 0,
  /** performance.now() when the next dash is available */
  dashReadyAt: 0,
  dashUntil: 0,
  stunUntil: 0,
  /** impulse queued by hazards (meteors); consumed by the controller */
  pendingImpulse: null as { x: number; y: number; z: number; stunMs: number } | null,
};

// Dev-only inspection hook (positions are not React state, so expose them for e2e tests / console debugging).
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __dropzone?: Record<string, unknown> }).__dropzone = { localPose, livePoses, remoteBuffers };
}
