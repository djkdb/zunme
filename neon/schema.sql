-- Optional: match history recorded by the RoomObject when DATABASE_URL is set.
-- Run once in the Neon SQL editor (or: psql "$DATABASE_URL" -f neon/schema.sql).
create table if not exists results (
  id           bigserial primary key,
  room_code    text        not null,
  round        int         not null,
  players      int         not null,
  winner_id    text,
  winner_name  text,
  ranking      jsonb       not null,   -- [{ "id": "...", "name": "..." }, ...] best → worst
  survived_ms  int         not null,
  played_at    timestamptz not null default now()
);
create index if not exists results_played_at_idx on results (played_at desc);
create index if not exists results_winner_idx on results (winner_name);
