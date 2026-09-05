/**
 * Transport abstraction over Supabase Realtime. Keeping the network
 * surface tiny (presence + broadcast) means the same RoomClient can later
 * talk to an authoritative game server instead of peers.
 */
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import type { PlayerPresence } from "@/types";

export type MessageHandler = (payload: unknown) => void;

export interface Transport {
  connect(roomCode: string, presence: PlayerPresence): Promise<void>;
  disconnect(): void;
  updatePresence(presence: PlayerPresence): void;
  onPresence(handler: (players: PlayerPresence[]) => void): void;
  on(event: string, handler: MessageHandler): void;
  send(event: string, payload: unknown): void;
  readonly offline: boolean;
}

function isPresence(v: unknown): v is PlayerPresence {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.nickname === "string" && typeof o.colorIndex === "number" && typeof o.joinedAt === "number";
}

export class SupabaseTransport implements Transport {
  readonly offline = false;
  private channel: RealtimeChannel | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private presenceHandler: ((players: PlayerPresence[]) => void) | null = null;
  private presence: PlayerPresence | null = null;

  async connect(roomCode: string, presence: PlayerPresence): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured");
    this.presence = presence;
    const channel = supabase.channel(`room:${roomCode}`, {
      config: { broadcast: { self: false, ack: false }, presence: { key: presence.id } },
    });
    this.channel = channel;

    channel.on("presence", { event: "sync" }, () => this.emitPresence());
    channel.on("broadcast", { event: "*" }, (msg: { event: string; payload: unknown }) => {
      this.handlers.get(msg.event)?.forEach((h) => h(msg.payload));
    });

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error("Connection timed out"));
        }
      }, 12000);
      channel.subscribe(async (status, err) => {
        if (status === "SUBSCRIBED") {
          await channel.track(presence);
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve();
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(err ?? new Error(`Realtime ${status}`));
          }
        }
      });
    });
  }

  private emitPresence() {
    if (!this.channel || !this.presenceHandler) return;
    const state = this.channel.presenceState<Record<string, unknown>>();
    const players: PlayerPresence[] = [];
    for (const key of Object.keys(state)) {
      const entries = state[key];
      const latest = entries[entries.length - 1];
      if (isPresence(latest)) {
        players.push({ id: latest.id, nickname: latest.nickname, colorIndex: latest.colorIndex, joinedAt: latest.joinedAt });
      }
    }
    this.presenceHandler(players);
  }

  disconnect() {
    const ch = this.channel;
    this.channel = null;
    if (ch) {
      void ch.untrack();
      void getSupabase()?.removeChannel(ch);
    }
  }

  updatePresence(presence: PlayerPresence) {
    this.presence = presence;
    void this.channel?.track(presence);
  }

  onPresence(handler: (players: PlayerPresence[]) => void) {
    this.presenceHandler = handler;
    this.emitPresence();
  }

  on(event: string, handler: MessageHandler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
  }

  send(event: string, payload: unknown) {
    void this.channel?.send({ type: "broadcast", event, payload });
  }
}

/**
 * Offline transport used when Supabase is not configured. Peers on the same
 * device (other tabs/windows) talk over a BroadcastChannel, so the whole
 * multiplayer path can be exercised locally; with a single tab it is simply
 * solo play. Presence is emulated with heartbeats + expiry.
 */
export class LocalTransport implements Transport {
  readonly offline = true;
  private presence: PlayerPresence | null = null;
  private presenceHandler: ((players: PlayerPresence[]) => void) | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private channel: BroadcastChannel | null = null;
  private peers = new Map<string, { presence: PlayerPresence; lastSeen: number }>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private static readonly HEARTBEAT = 1000;
  private static readonly EXPIRY = 4000;

  async connect(roomCode: string, presence: PlayerPresence) {
    this.presence = presence;
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(`dropzone:${roomCode}`);
      this.channel.onmessage = (ev: MessageEvent<{ kind: string; from: string; event?: string; payload?: unknown; presence?: PlayerPresence }>) => {
        const msg = ev.data;
        if (!msg || msg.from === this.presence?.id) return;
        if (msg.kind === "hello" || msg.kind === "presence") {
          if (isPresence(msg.presence)) {
            this.peers.set(msg.from, { presence: msg.presence, lastSeen: Date.now() });
            if (msg.kind === "hello") this.announce("presence");
            this.emitPresence();
          }
        } else if (msg.kind === "leave") {
          this.peers.delete(msg.from);
          this.emitPresence();
        } else if (msg.kind === "broadcast" && msg.event) {
          this.handlers.get(msg.event)?.forEach((h) => h(msg.payload));
        }
      };
      this.announce("hello");
      this.timer = setInterval(() => {
        this.announce("presence");
        const now = Date.now();
        let changed = false;
        this.peers.forEach((p, id) => {
          if (now - p.lastSeen > LocalTransport.EXPIRY) {
            this.peers.delete(id);
            changed = true;
          }
        });
        if (changed) this.emitPresence();
      }, LocalTransport.HEARTBEAT);
      window.addEventListener("pagehide", this.onPageHide);
    }
    this.emitPresence();
  }

  private onPageHide = () => {
    this.post({ kind: "leave" });
  };

  private post(msg: Record<string, unknown>) {
    if (!this.channel || !this.presence) return;
    try {
      this.channel.postMessage({ ...msg, from: this.presence.id });
    } catch {
      /* channel closed */
    }
  }

  private announce(kind: "hello" | "presence") {
    this.post({ kind, presence: this.presence });
  }

  private emitPresence() {
    if (!this.presence) return;
    const list = [this.presence, ...Array.from(this.peers.values()).map((p) => p.presence)];
    this.presenceHandler?.(list);
  }

  disconnect() {
    this.post({ kind: "leave" });
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (typeof window !== "undefined") window.removeEventListener("pagehide", this.onPageHide);
    this.channel?.close();
    this.channel = null;
    this.peers.clear();
    this.presence = null;
  }

  updatePresence(presence: PlayerPresence) {
    this.presence = presence;
    this.announce("presence");
    this.emitPresence();
  }

  onPresence(handler: (players: PlayerPresence[]) => void) {
    this.presenceHandler = handler;
    this.emitPresence();
  }

  on(event: string, handler: MessageHandler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
  }

  send(event: string, payload: unknown) {
    this.post({ kind: "broadcast", event, payload });
  }
}
