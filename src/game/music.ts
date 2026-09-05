/**
 * Procedural background music — zero copyright concerns because every
 * note is synthesised at runtime. A small step sequencer (16th notes,
 * look-ahead scheduling on the WebAudio clock) plays a bass line, a chord
 * pad, an arpeggio and drums; each screen/mode has its own key, tempo and
 * patterns, and tension (sudden death, hurry-up, final 2) raises the tempo.
 *
 * If you ever want real tracks instead, drop files at MUSIC_PATHS and set
 * USE_MUSIC_FILES — the manager will stream them and skip the synth.
 */
export type MusicTrack = "menu" | "lobby" | "SUMO" | "RACE" | "MELTDOWN" | "GOGUN" | "result";

export const USE_MUSIC_FILES = false;
export const MUSIC_PATHS: Record<MusicTrack, string> = {
  menu: "/music/menu.mp3",
  lobby: "/music/lobby.mp3",
  SUMO: "/music/dropzone.mp3",
  RACE: "/music/skydash.mp3",
  MELTDOWN: "/music/meltdown.mp3",
  GOGUN: "/music/gogun.mp3",
  result: "/music/result.mp3",
};
export const MUSIC_VOLUME = 0.32;

// ── note helpers ─────────────────────────────────────────────────────
const A4 = 440;
/** MIDI note number → Hz */
const hz = (midi: number) => A4 * Math.pow(2, (midi - 69) / 12);

interface Song {
  bpm: number;
  /** root MIDI note */
  root: number;
  /** chord progression as scale degrees (semitone offsets), one per bar */
  chords: number[][];
  /** bass pattern: 16 steps, offset from chord root or null */
  bass: (number | null)[];
  /** arpeggio pattern over the chord tones (index into chord) or null */
  arp: (number | null)[];
  /** drums: k=kick, s=snare, h=hat, "" = rest */
  drums: string[];
  lead?: (number | null)[];
  bassWave: OscillatorType;
  arpWave: OscillatorType;
  padWave: OscillatorType;
  swing?: number;
}

const MAJ = [0, 4, 7, 11];
const MIN = [0, 3, 7, 10];
const SUS = [0, 5, 7, 12];
const t = (root: number, kind: number[]) => kind.map((k) => root + k);

const SONGS: Record<MusicTrack, Song> = {
  menu: {
    bpm: 104,
    root: 57, // A3
    chords: [t(0, MAJ), t(-4, MAJ), t(-7, MAJ), t(-5, SUS)],
    bass: [0, null, null, 0, null, null, 7, null, 0, null, null, 0, null, 12, null, null],
    arp: [0, 1, 2, 3, 2, 1, 0, 2, 1, 3, 2, 1, 0, 2, 3, 1],
    drums: ["kh", "", "h", "", "sh", "", "h", "", "kh", "", "h", "k", "sh", "", "h", ""],
    bassWave: "triangle",
    arpWave: "sine",
    padWave: "triangle",
  },
  lobby: {
    bpm: 112,
    root: 60,
    chords: [t(0, MAJ), t(5, MAJ), t(-3, MIN), t(7, MAJ)],
    bass: [0, null, 0, null, null, 0, null, null, 0, null, 0, null, 7, null, 5, null],
    arp: [0, null, 2, null, 1, null, 3, null, 0, null, 2, null, 1, 2, 3, null],
    drums: ["kh", "", "h", "", "sh", "", "h", "k", "kh", "", "h", "", "sh", "", "h", "h"],
    bassWave: "triangle",
    arpWave: "square",
    padWave: "sine",
  },
  SUMO: {
    bpm: 128,
    root: 52, // E3
    chords: [t(0, MIN), t(0, MIN), t(-2, MAJ), t(3, MAJ)],
    bass: [0, 0, null, 0, null, 0, 0, null, 0, 0, null, 0, 12, null, 10, null],
    arp: [0, 2, 3, 2, 0, 2, 3, 1, 0, 2, 3, 2, 1, 3, 2, 0],
    drums: ["k", "h", "h", "k", "s", "h", "h", "", "k", "h", "k", "h", "s", "h", "", "h"],
    lead: [null, null, null, null, 12, null, 15, null, null, null, null, null, 14, null, 12, 10],
    bassWave: "sawtooth",
    arpWave: "square",
    padWave: "sawtooth",
  },
  RACE: {
    bpm: 148,
    root: 55, // G3
    chords: [t(0, MAJ), t(-3, MIN), t(5, MAJ), t(7, MAJ)],
    bass: [0, null, 0, 0, null, 0, null, 0, 0, null, 0, 0, null, 7, null, 5],
    arp: [0, 2, 1, 3, 0, 2, 1, 3, 2, 3, 0, 2, 1, 3, 2, 0],
    drums: ["kh", "h", "h", "kh", "sh", "h", "h", "k", "kh", "h", "kh", "h", "sh", "h", "h", "s"],
    bassWave: "square",
    arpWave: "square",
    padWave: "triangle",
    swing: 0.08,
  },
  MELTDOWN: {
    bpm: 136,
    root: 50, // D3
    chords: [t(0, MIN), t(-4, MAJ), t(-7, MIN), t(-2, MAJ)],
    bass: [0, null, null, 0, null, null, 0, null, 3, null, null, 3, null, 5, null, null],
    arp: [3, 2, 1, 0, 3, 2, 1, 0, 2, 3, 1, 0, 3, 1, 2, 0],
    drums: ["k", "", "h", "k", "s", "", "h", "", "k", "k", "h", "", "s", "", "h", "h"],
    bassWave: "sawtooth",
    arpWave: "sawtooth",
    padWave: "sine",
  },
  GOGUN: {
    bpm: 140,
    root: 57, // A3 — a touch of pentatonic "ninja" flavour
    chords: [t(0, MIN), t(0, MIN), t(-2, MAJ), t(-5, MAJ)],
    bass: [0, null, 0, null, 7, null, 0, null, 0, null, 0, 3, null, 5, null, null],
    arp: [0, 2, 3, 0, 2, 3, 1, 2, 0, 2, 3, 0, 1, 3, 2, 1],
    drums: ["k", "h", "h", "k", "s", "h", "k", "h", "k", "h", "h", "k", "s", "h", "h", "h"],
    lead: [12, null, null, 15, null, 17, null, null, 12, null, 15, null, 19, null, 17, 15],
    bassWave: "triangle",
    arpWave: "square",
    padWave: "triangle",
    swing: 0.06,
  },
  result: {
    bpm: 96,
    root: 60,
    chords: [t(0, MAJ), t(5, MAJ), t(-5, MAJ), t(0, MAJ)],
    bass: [0, null, null, null, 0, null, null, null, 0, null, null, null, 7, null, null, null],
    arp: [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1],
    drums: ["k", "", "h", "", "s", "", "h", "", "k", "", "h", "", "s", "", "h", "h"],
    bassWave: "triangle",
    arpWave: "sine",
    padWave: "sine",
  },
};

class MusicManager {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private track: MusicTrack | null = null;
  private step = 0;
  private nextTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private tempoMul = 1;
  private _muted = false;
  private fileSource: AudioBufferSourceNode | null = null;
  private fileCache = new Map<MusicTrack, AudioBuffer | null>();
  private noiseBuffer: AudioBuffer | null = null;

  /** Attach to the shared audio context (called by the sound manager on unlock). */
  attach(ctx: AudioContext, master: AudioNode) {
    if (this.ctx) return;
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = this._muted ? 0 : MUSIC_VOLUME;
    this.out.connect(master);
    if (this.track) this.start(this.track);
  }

  setMuted(muted: boolean) {
    this._muted = muted;
    if (this.out && this.ctx) this.out.gain.setTargetAtTime(muted ? 0 : MUSIC_VOLUME, this.ctx.currentTime, 0.05);
  }

  /** Raise/lower tempo for tension (1 = normal). */
  setTension(mul: number) {
    this.tempoMul = mul;
  }

  play(track: MusicTrack) {
    if (this.track === track) return;
    this.track = track;
    if (!this.ctx) return; // will start on attach
    this.start(track);
  }

  stop() {
    this.track = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stopFile();
  }

  private stopFile() {
    try {
      this.fileSource?.stop();
    } catch {
      /* already stopped */
    }
    this.fileSource = null;
  }

  private async start(track: MusicTrack) {
    if (!this.ctx || !this.out) return;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stopFile();
    if (USE_MUSIC_FILES) {
      const buf = await this.loadFile(track);
      if (buf && this.track === track) {
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(this.out);
        src.start();
        this.fileSource = src;
        return;
      }
    }
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), 60);
  }

  private async loadFile(track: MusicTrack): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;
    if (this.fileCache.has(track)) return this.fileCache.get(track) ?? null;
    try {
      const res = await fetch(MUSIC_PATHS[track]);
      if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("audio")) throw new Error("missing");
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
      this.fileCache.set(track, buf);
      return buf;
    } catch {
      this.fileCache.set(track, null);
      return null;
    }
  }

  // ── sequencer ──────────────────────────────────────────────────────
  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.track) return;
    const song = SONGS[this.track];
    const stepDur = 60 / (song.bpm * this.tempoMul) / 4;
    while (this.nextTime < ctx.currentTime + 0.2) {
      const swing = song.swing && this.step % 2 === 1 ? stepDur * song.swing : 0;
      this.playStep(song, this.step, this.nextTime + swing, stepDur);
      this.step = (this.step + 1) % (16 * song.chords.length);
      this.nextTime += stepDur;
    }
  }

  private playStep(song: Song, step: number, when: number, dur: number) {
    const ctx = this.ctx;
    const out = this.out;
    if (!ctx || !out) return;
    const bar = Math.floor(step / 16) % song.chords.length;
    const i = step % 16;
    const chord = song.chords[bar];
    const rootMidi = song.root + chord[0];

    // pad on the downbeat
    if (i === 0) {
      chord.forEach((n) => this.tone(hz(song.root + n), when, dur * 15.5, song.padWave, 0.045, 0.4, out));
    }
    const b = song.bass[i];
    if (b !== null) this.tone(hz(rootMidi - 12 + b), when, dur * 0.9, song.bassWave, 0.16, 0.02, out, 0.9);
    const a = song.arp[i];
    if (a !== null) this.tone(hz(song.root + 12 + chord[a % chord.length] + (a >= chord.length ? 12 : 0)), when, dur * 0.8, song.arpWave, 0.06, 0.01, out, 0.3);
    const l = song.lead?.[i];
    if (l !== null && l !== undefined && bar % 2 === 1) this.tone(hz(song.root + 12 + l), when, dur * 1.6, "square", 0.05, 0.02, out, 0.5);
    const d = song.drums[i];
    if (d.includes("k")) this.kick(when, out);
    if (d.includes("s")) this.snare(when, out);
    if (d.includes("h")) this.hat(when, out);
  }

  private tone(freq: number, when: number, dur: number, type: OscillatorType, gain: number, attack: number, dest: AudioNode, release = 0.2) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(gain, when + attack);
    g.gain.setTargetAtTime(0.0001, when + dur, release * 0.35);
    osc.connect(g).connect(dest);
    osc.start(when);
    osc.stop(when + dur + release + 0.1);
  }

  private kick(when: number, dest: AudioNode) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, when);
    osc.frequency.exponentialRampToValueAtTime(45, when + 0.12);
    g.gain.setValueAtTime(0.35, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.25);
    osc.connect(g).connect(dest);
    osc.start(when);
    osc.stop(when + 0.3);
  }

  private noise(when: number, dur: number, gain: number, filterHz: number, type: BiquadFilterType, dest: AudioNode) {
    const ctx = this.ctx!;
    if (!this.noiseBuffer) {
      this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterHz;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(when);
    src.stop(when + dur + 0.05);
  }

  private snare(when: number, dest: AudioNode) {
    this.noise(when, 0.16, 0.18, 1800, "highpass", dest);
    this.tone(190, when, 0.08, "triangle", 0.12, 0.005, dest, 0.05);
  }

  private hat(when: number, dest: AudioNode) {
    this.noise(when, 0.05, 0.07, 7000, "highpass", dest);
  }
}

export const music = new MusicManager();
