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

/** Solo/offline transport used when Supabase is not configured. */
export class LocalTransport implements Transport {
  readonly offline = true;
  private presence: PlayerPresence | null = null;
  private presenceHandler: ((players: PlayerPresence[]) => void) | null = null;

  async connect(_roomCode: string, presence: PlayerPresence) {
    this.presence = presence;
    this.presenceHandler?.([presence]);
  }
  disconnect() {
    this.presence = null;
  }
  updatePresence(presence: PlayerPresence) {
    this.presence = presence;
    this.presenceHandler?.([presence]);
  }
  onPresence(handler: (players: PlayerPresence[]) => void) {
    this.presenceHandler = handler;
    if (this.presence) handler([this.presence]);
  }
  on() {
    /* no remote peers */
  }
  send() {
    /* no remote peers */
  }
}
