/**
 * RoomObject — one Durable Object per room code. It is the realtime hub:
 * presence (who is in the room) + broadcast relay (state, snapshots, events),
 * exactly the two primitives the client Transport needs. Uses the WebSocket
 * Hibernation API so idle rooms cost nothing.
 *
 * Optionally records finished rounds into Neon (Postgres) when DATABASE_URL
 * is set — see neon/schema.sql.
 */
import { DurableObject } from "cloudflare:workers";
import { neon } from "@neondatabase/serverless";
import { computeRanking } from "../src/game/authority";
import { MAX_PLAYERS } from "../src/game/config";
import type { GameState, PlayerPresence } from "../src/types";

export interface Env {
  ROOMS: DurableObjectNamespace<RoomObject>;
  ASSETS: Fetcher;
  DATABASE_URL?: string;
}

type ClientMessage =
  | { t: "join"; presence: PlayerPresence }
  | { t: "presence"; presence: PlayerPresence }
  | { t: "bc"; event: string; payload: unknown };

const MAX_MESSAGES_PER_SECOND = 40;
const MAX_MESSAGE_BYTES = 8 * 1024;

function isPresence(v: unknown): v is PlayerPresence {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    o.id.length <= 32 &&
    typeof o.nickname === "string" &&
    o.nickname.length <= 24 &&
    typeof o.colorIndex === "number" &&
    typeof o.joinedAt === "number"
  );
}

export class RoomObject extends DurableObject<Env> {
  private rate = new Map<WebSocket, { count: number; windowStart: number }>();

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  private roomCode(): string {
    return this.ctx.id.name ?? "";
  }

  private players(exclude?: WebSocket): PlayerPresence[] {
    const list: PlayerPresence[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === exclude) continue;
      const p = ws.deserializeAttachment() as PlayerPresence | null;
      if (p) list.push(p);
    }
    return list;
  }

  private broadcastPresence(exclude?: WebSocket) {
    const msg = JSON.stringify({ t: "presence", players: this.players(exclude) });
    for (const ws of this.ctx.getWebSockets()) if (ws !== exclude) this.safeSend(ws, msg);
  }

  private safeSend(ws: WebSocket, data: string) {
    try {
      ws.send(data);
    } catch {
      /* socket already gone */
    }
  }

  private allowed(ws: WebSocket): boolean {
    const now = Date.now();
    const r = this.rate.get(ws) ?? { count: 0, windowStart: now };
    if (now - r.windowStart > 1000) {
      r.count = 0;
      r.windowStart = now;
    }
    r.count++;
    this.rate.set(ws, r);
    return r.count <= MAX_MESSAGES_PER_SECOND;
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== "string" || raw.length > MAX_MESSAGE_BYTES || !this.allowed(ws)) return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }
    const self = ws.deserializeAttachment() as PlayerPresence | null;

    if (msg.t === "join") {
      if (!isPresence(msg.presence)) return ws.close(4000, "bad presence");
      const others = this.players().filter((p) => p.id !== msg.presence.id);
      if (others.length >= MAX_PLAYERS) {
        this.safeSend(ws, JSON.stringify({ t: "full" }));
        return ws.close(4001, "room full");
      }
      // A reconnecting player replaces their previous socket.
      for (const other of this.ctx.getWebSockets()) {
        if (other !== ws && (other.deserializeAttachment() as PlayerPresence | null)?.id === msg.presence.id) other.close(4002, "replaced");
      }
      ws.serializeAttachment(msg.presence);
      this.broadcastPresence();
      return;
    }

    if (!self) return; // must join first

    if (msg.t === "presence") {
      if (!isPresence(msg.presence) || msg.presence.id !== self.id) return;
      ws.serializeAttachment(msg.presence);
      this.broadcastPresence();
      return;
    }

    if (msg.t === "bc" && typeof msg.event === "string") {
      const out = JSON.stringify({ t: "bc", event: msg.event, payload: msg.payload, from: self.id });
      for (const other of this.ctx.getWebSockets()) if (other !== ws) this.safeSend(other, out);
      if (msg.event === "state") this.maybeRecordResult(msg.payload);
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    this.rate.delete(ws);
    try {
      ws.close(code, reason);
    } catch {
      /* already closed */
    }
    this.broadcastPresence(ws);
  }

  async webSocketError(ws: WebSocket) {
    this.rate.delete(ws);
    try {
      ws.close(1011, "error");
    } catch {
      /* already closed */
    }
    this.broadcastPresence(ws);
  }

  // ── Optional Neon persistence ──────────────────────────────────────
  private maybeRecordResult(payload: unknown) {
    const url = this.env.DATABASE_URL;
    if (!url || !payload || typeof payload !== "object") return;
    const state = (payload as { state?: GameState }).state;
    if (!state || state.status !== "FINISHED" || !state.startAt || state.participants.length === 0) return;
    const key = `${state.round}:${state.startAt}`;
    this.ctx.waitUntil(
      (async () => {
        const done = await this.ctx.storage.get<string>("lastRecorded");
        if (done === key) return;
        await this.ctx.storage.put("lastRecorded", key);
        const names = new Map(this.players().map((p) => [p.id, p.nickname]));
        const ranking = computeRanking(state).map((id) => ({ id, name: names.get(id) ?? null }));
        const sql = neon(url);
        await sql`
          insert into results (room_code, round, players, winner_id, winner_name, ranking, survived_ms)
          values (${this.roomCode()}, ${state.round}, ${state.participants.length}, ${state.winnerId},
                  ${state.winnerId ? (names.get(state.winnerId) ?? null) : null}, ${JSON.stringify(ranking)}::jsonb,
                  ${Math.max(0, state.endAt - state.startAt)})
        `;
      })().catch((err: unknown) => console.error("neon insert failed", err)),
    );
  }
}
