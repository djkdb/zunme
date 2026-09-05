/**
 * Sound manager. Loads files from SOUND_PATHS when they exist; when a
 * file is missing it falls back to a short procedurally synthesized cue
 * so the game always has audible feedback. Audio is unlocked on the first
 * user gesture to satisfy browser autoplay policies.
 */
import { SOUND_PATHS, USE_SOUND_FILES, type SoundName } from "@/game/config";

type Synth = (ctx: AudioContext, dest: AudioNode, when: number) => void;

const tone =
  (freq: number, duration: number, type: OscillatorType = "square", gain = 0.18, slide = 0): Synth =>
  (ctx, dest, when) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (slide !== 0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), when + duration);
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + duration);
    osc.connect(g).connect(dest);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  };

const noise =
  (duration: number, gain = 0.25, lowpass = 800): Synth =>
  (ctx, dest, when) => {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = lowpass;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + duration);
    src.connect(filter).connect(g).connect(dest);
    src.start(when);
  };

const chord =
  (freqs: number[], duration: number, gap = 0.08): Synth =>
  (ctx, dest, when) => {
    freqs.forEach((f, i) => tone(f, duration, "triangle", 0.16)(ctx, dest, when + i * gap));
  };

const SYNTH: Record<SoundName, Synth> = {
  click: tone(880, 0.06, "square", 0.08),
  countdown: tone(520, 0.18, "square", 0.14),
  go: chord([660, 880, 1320], 0.35, 0.04),
  jump: tone(320, 0.16, "sine", 0.14, 260),
  impact: noise(0.14, 0.3, 600),
  elimination: (ctx, dest, when) => {
    tone(420, 0.5, "sawtooth", 0.14, -300)(ctx, dest, when);
    noise(0.35, 0.25, 400)(ctx, dest, when);
  },
  win: chord([523, 659, 784, 1046, 1318], 0.6, 0.11),
  dash: (ctx, dest, when) => {
    noise(0.18, 0.22, 2400)(ctx, dest, when);
    tone(220, 0.14, "sine", 0.1, 380)(ctx, dest, when);
  },
  warning: (ctx, dest, when) => {
    tone(880, 0.08, "square", 0.08)(ctx, dest, when);
    tone(880, 0.08, "square", 0.08)(ctx, dest, when + 0.14);
  },
};

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<SoundName, AudioBuffer | null>();
  private loading = false;
  private _muted = false;
  private lastPlayed = new Map<SoundName, number>();

  get muted() {
    return this._muted;
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
      void this.preload();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean) {
    this._muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.8;
    try {
      localStorage.setItem("dropzone:muted", muted ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  restoreMutePreference() {
    try {
      this._muted = localStorage.getItem("dropzone:muted") === "1";
    } catch {
      /* ignore */
    }
  }

  private async preload() {
    if (this.loading || !this.ctx || !USE_SOUND_FILES) return;
    this.loading = true;
    const ctx = this.ctx;
    await Promise.all(
      (Object.keys(SOUND_PATHS) as SoundName[]).map(async (name) => {
        try {
          const res = await fetch(SOUND_PATHS[name], { method: "GET" });
          const type = res.headers.get("content-type") ?? "";
          if (!res.ok || !type.startsWith("audio")) throw new Error("missing");
          const buf = await ctx.decodeAudioData(await res.arrayBuffer());
          this.buffers.set(name, buf);
        } catch {
          this.buffers.set(name, null); // synth fallback
        }
      }),
    );
  }

  play(name: SoundName, opts: { volume?: number; throttleMs?: number } = {}) {
    if (!this.ctx || !this.master || this._muted) return;
    const now = performance.now();
    const last = this.lastPlayed.get(name) ?? -Infinity;
    if (opts.throttleMs && now - last < opts.throttleMs) return;
    this.lastPlayed.set(name, now);

    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = opts.volume ?? 1;
    gain.connect(this.master);
    const buffer = this.buffers.get(name);
    if (buffer) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(gain);
      src.start();
    } else {
      SYNTH[name](ctx, gain, ctx.currentTime);
    }
  }
}

export const sound = new SoundManager();
