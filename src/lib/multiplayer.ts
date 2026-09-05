/**
 * RoomClient — glues a Transport to the game state.
 *
 *  - Presence gives the live player list; the earliest joiner is host.
 *  - The host runs GameAuthority and broadcasts `state` on change plus a
 *    1 Hz heartbeat. Clients mirror it (last version wins).
 *  - Everyone broadcasts transform snapshots at NET_TICK_RATE and sends
 *    gameplay events (falls) that the host validates against the state.
 *  - If the host disappears, the next player in join order takes over the
 *    last known state automatically.
 */

function createTransport(): Transport {
  switch (getRealtimeBackend()) {
    case "supabase":
      return new SupabaseTransport();
    case "worker":
      return new WorkerTransport(getRealtimeUrl() as string);
    default:
      return new LocalTransport();
  }
}
import { GameAuthority, createInitialState } from "@/game/authority";
import { NET_STATE_HEARTBEAT, NET_TICK_RATE } from "@/game/config";
import { clearSnapshots, pushSnapshot } from "@/game/remote";
import { electHost, sortPlayers } from "@/lib/room";
import { getRealtimeBackend, getRealtimeUrl } from "@/lib/realtime";
import { LocalTransport, SupabaseTransport, WorkerTransport, type Transport } from "@/lib/transport";
import { emitGameplayEvent, type GameplayEvent } from "@/game/sync";
import type { ClientEvent, GameMode, GameState, PlayerPresence, PlayerSnapshot } from "@/types";

interface StateMessage {
  state: GameState;
  hostNow: number;
}

export interface RoomClientCallbacks {
  onPlayers(players: PlayerPresence[], hostId: string | null): void;
  onState(state: GameState): void;
  onEvent(evt: ClientEvent): void;
  onError(message: string): void;
}

export class RoomClient {
  readonly transport: Transport;
  readonly roomCode: string;
  readonly localId: string;
  private presence: PlayerPresence;
  private players: PlayerPresence[] = [];
  private hostId: string | null = null;
  private authority: GameAuthority | null = null;
  private state: GameState;
  /** hostTime - localTime */
  private clockOffset = 0;
  private hostTimer: ReturnType<typeof setInterval> | null = null;
  private lastStateBroadcast = 0;
  private lastSnapshotSent = 0;
  private callbacks: RoomClientCallbacks;
  private disposed = false;

  constructor(roomCode: string, presence: PlayerPresence, callbacks: RoomClientCallbacks) {
    this.roomCode = roomCode;
    this.localId = presence.id;
    this.presence = presence;
    this.callbacks = callbacks;
    this.transport = createTransport();
    this.state = createInitialState(presence.id);
  }

  get isHost() {
    return this.hostId === this.localId;
  }

  get currentState() {
    return this.state;
  }

  get currentPlayers() {
    return this.players;
  }

  get offline() {
    return this.transport.offline;
  }

  /** Host-synchronised wall clock in ms. */
  now(): number {
    return Date.now() + this.clockOffset;
  }

  async connect() {
    this.transport.on("state", (payload) => this.onStateMessage(payload as StateMessage));
    this.transport.on("snap", (payload) => this.onSnapshot(payload as PlayerSnapshot));
    this.transport.on("event", (payload) => this.onClientEvent(payload as ClientEvent));
    this.transport.on("play", (payload) => {
      if (!this.disposed) emitGameplayEvent(payload as GameplayEvent);
    });
    this.transport.onPresence((players) => this.onPresence(players));
    await this.transport.connect(this.roomCode, this.presence);
    this.hostTimer = setInterval(() => this.hostTick(), 100);
  }

  disconnect() {
    this.disposed = true;
    if (this.hostTimer) clearInterval(this.hostTimer);
    this.transport.disconnect();
    clearSnapshots();
  }

  updateNickname(nickname: string) {
    this.presence = { ...this.presence, nickname };
    this.transport.updatePresence(this.presence);
  }

  // ── Presence / host election ───────────────────────────────────────
  private onPresence(players: PlayerPresence[]) {
    if (this.disposed) return;
    // Make sure we are always in our own list, even before the sync echoes back.
    if (!players.some((p) => p.id === this.localId)) players = [...players, this.presence];
    this.players = sortPlayers(players);
    const newHost = electHost(this.players);
    const wasHost = this.isHost;
    this.hostId = newHost;

    if (this.isHost && !wasHost) this.becomeHost();
    if (!this.isHost && wasHost) this.authority = null;

    this.callbacks.onPlayers(this.players, this.hostId);
  }

  private becomeHost() {
    // Take over the most recent state we know about, rebased onto our clock.
    const authority = new GameAuthority(this.state, this.localId);
    authority.rebase(this.clockOffset);
    this.clockOffset = 0;
    this.authority = authority;
    this.broadcastState(true);
  }

  // ── Host loop ──────────────────────────────────────────────────────
  private hostTick() {
    if (!this.authority || this.disposed) return;
    const now = this.now();
    this.authority.tick(
      now,
      this.players.map((p) => p.id),
    );
    const changed = this.authority.consumeChanged();
    if (changed || now - this.lastStateBroadcast > NET_STATE_HEARTBEAT) this.broadcastState(changed);
  }

  private broadcastState(force: boolean) {
    if (!this.authority) return;
    const state = this.authority.state;
    this.lastStateBroadcast = this.now();
    const msg: StateMessage = { state, hostNow: Date.now() };
    this.transport.send("state", msg);
    if (force || state.version !== this.state.version) {
      this.state = state;
      this.callbacks.onState(state);
    }
  }

  // ── Host actions (no-ops for non-hosts) ────────────────────────────
  startGame() {
    if (!this.authority) return;
    const participants = this.players.map((p) => p.id);
    this.authority.startCountdown(participants, this.now());
    this.broadcastState(true);
  }

  setMode(mode: GameMode) {
    if (!this.authority) return;
    this.authority.setMode(mode);
    this.broadcastState(true);
  }

  returnToLobby() {
    if (!this.authority) return;
    this.authority.returnToLobby();
    this.broadcastState(true);
  }

  /** Fire-and-forget gameplay event to every peer (applied locally too). */
  broadcastGameplay(evt: GameplayEvent) {
    emitGameplayEvent(evt);
    if (this.players.length > 1) this.transport.send("play", evt);
  }

  // ── Client → host events ───────────────────────────────────────────
  sendEvent(evt: ClientEvent) {
    if (this.authority) {
      this.authority.handleEvent(evt, this.now());
      if (this.authority.consumeChanged()) this.broadcastState(true);
    } else {
      this.transport.send("event", evt);
    }
    this.callbacks.onEvent(evt);
  }

  private onClientEvent(evt: ClientEvent) {
    if (this.disposed) return;
    if (this.authority) {
      this.authority.handleEvent(evt, this.now());
      if (this.authority.consumeChanged()) this.broadcastState(true);
    }
    this.callbacks.onEvent(evt);
  }

  // ── State mirror ───────────────────────────────────────────────────
  private onStateMessage(msg: StateMessage) {
    if (this.disposed || !msg?.state) return;
    // Only trust the elected host, except while presence hasn't settled yet.
    if (this.hostId && msg.state.hostId !== this.hostId && this.players.some((p) => p.id === this.hostId)) {
      // A stale host may still be broadcasting for a moment; ignore unless newer.
      if (msg.state.version <= this.state.version) return;
    }
    if (this.isHost) return; // we are authoritative
    if (msg.state.version < this.state.version && msg.state.hostId === this.state.hostId) return;
    this.clockOffset = msg.hostNow - Date.now();
    this.state = msg.state;
    this.callbacks.onState(msg.state);
  }

  // ── Snapshots ──────────────────────────────────────────────────────
  private onSnapshot(snap: PlayerSnapshot) {
    if (this.disposed || snap.id === this.localId) return;
    pushSnapshot(snap);
  }

  /** Called from the physics loop; throttled to NET_TICK_RATE internally. */
  sendSnapshot(build: (t: number) => Omit<PlayerSnapshot, "id" | "t">) {
    if (this.players.length < 2) return; // nobody to tell
    const nowLocal = performance.now();
    if (nowLocal - this.lastSnapshotSent < 1000 / NET_TICK_RATE) return;
    this.lastSnapshotSent = nowLocal;
    const t = this.now();
    const snap: PlayerSnapshot = { id: this.localId, t, ...build(t) };
    this.transport.send("snap", snap);
  }
}
