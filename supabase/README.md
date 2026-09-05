# Supabase setup for DROPZONE

DROPZONE only needs **Supabase Realtime** (Presence + Broadcast). No tables are
required for the MVP: rooms live entirely in realtime channels named
`room:<CODE>`, and the earliest-joined player acts as the host authority.

1. Create a project at https://supabase.com.
2. Copy the project URL and anon key into `.env.local` (see `.env.example`).
3. Make sure Realtime is enabled for the project (it is by default).

That's it. Rate limits: each player broadcasts transforms at 10 Hz
(`NET_TICK_RATE` in `src/game/config.ts`), so an 8-player room sends roughly
80 messages/s plus the host's state heartbeat — under the default Realtime
quota of 100 messages/s. Raise the quota in *Project Settings → Realtime* if
you increase the tick rate.

## Optional: persisting rooms

If you later want room history / leaderboards, the shape the client already
uses is in `src/types/index.ts` (`Room`, `Player`, `GameState`). A minimal
schema would be:

```sql
create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id text not null,
  status text not null default 'LOBBY',
  created_at timestamptz not null default now()
);
create table results (
  id bigint generated always as identity primary key,
  room_code text not null,
  round int not null,
  winner_id text,
  ranking jsonb not null,
  played_at timestamptz not null default now()
);
```
