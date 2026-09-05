# Deploying DROPZONE — Cloudflare Workers (+ optional Neon)

DROPZONE ships with its own realtime server: a **Cloudflare Durable Object**
(`worker/room-object.ts`) that handles presence and message relay for each
room. It deploys together with the Next.js app in one Worker, so the whole
game runs on Cloudflare's free plan with **no Supabase required**.

**Neon** (serverless Postgres) is optional: when you give the Worker a
`DATABASE_URL`, every finished round is recorded in a `results` table
(winner, ranking, survival time) for a future leaderboard. Neon is a
database, not a realtime channel — it does not replace the Durable Object.

| Piece | Service | Cost |
| --- | --- | --- |
| Next.js app + static assets | Cloudflare Workers (OpenNext) | free |
| Realtime rooms (`/ws`) | Cloudflare Durable Objects (SQLite-backed) | free plan OK |
| Match history (optional) | Neon Postgres | free tier |
| Alternative realtime | Supabase Realtime | only if you set its env vars |

### Free-tier budget (Cloudflare Workers Free plan)

- Workers: 100,000 requests/day — page loads and assets.
- Durable Objects: included on the Free plan (SQLite-backed). Incoming
  WebSocket messages via the Hibernation API are billed at 1/20 of a
  request, so the 100,000/day allowance covers ~2 million game messages —
  roughly 300 full 8-player rounds per day at the default 10 Hz tick.
- Nothing else is needed: no database, no card on file.

---

## 1. Deploy to Cloudflare

### Option A — from your machine

```bash
npx wrangler login          # one-time, opens the browser
npm run preview             # builds + runs the Worker (with the Durable Object) at http://localhost:8787
npm run deploy              # → https://dropzone.<your-subdomain>.workers.dev
```

That's it. Production builds default `NEXT_PUBLIC_REALTIME_URL` to `/ws`
(same origin), so the client talks to the Durable Object automatically.

### Option B — Git-connected (auto-deploy on push)

1. Cloudflare dashboard → **Workers & Pages → Create → Workers →
   Import a repository** → pick this repo/branch.
2. Build settings:
   - **Build command**: `npx opennextjs-cloudflare build`
   - **Deploy command**: `npx opennextjs-cloudflare deploy`
3. No environment variables are required for the default setup.
4. Save → every push redeploys.

The first deploy applies the Durable Object migration in `wrangler.jsonc`
(`new_sqlite_classes: ["RoomObject"]`). SQLite-backed Durable Objects are
available on the free plan.

### Custom domain

Worker → **Settings → Domains & Routes → Add custom domain**. Share links
like `https://your-domain.com/room/ABC123`.

---

## 2. Optional: Neon match history

1. <https://console.neon.tech> → **New project** (any region).
2. In the SQL editor run the contents of [`neon/schema.sql`](neon/schema.sql).
3. Copy the **connection string** (Pooled or direct both work; it must end
   with `?sslmode=require`).
4. Give it to the Worker as a **secret** (never as a `NEXT_PUBLIC_` var):

   ```bash
   npx wrangler secret put DATABASE_URL
   # paste: postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```

   For Git-connected deploys add it under **Settings → Variables and
   Secrets** (type *Secret*) instead.
5. Redeploy. From now on each finished round inserts one row:

   ```sql
   select played_at, room_code, players, winner_name, survived_ms from results order by played_at desc limit 20;
   ```

Local preview: create `.dev.vars` (git-ignored) with
`DATABASE_URL=...` and run `npm run preview`.

---

## 3. Realtime backend selection (reference)

The client picks a transport in this order (`src/lib/realtime.ts`):

1. **Supabase Realtime** — if `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set at build time.
2. **Worker WebSocket** — `NEXT_PUBLIC_REALTIME_URL` (default `/ws` in
   production builds; set `off` to disable, or an absolute `wss://…` URL to
   point a separately hosted frontend at the Worker).
3. **Local mode** — BroadcastChannel between tabs on the same device
   (what `npm run dev` uses when nothing is configured).

`NEXT_PUBLIC_*` values are inlined at **build** time, so they must exist in
the build environment (Cloudflare build variables, or your shell when
running `npm run deploy`).

---

## 4. Checklist before sharing the link

- [ ] Open the deployed URL on a phone and a laptop; create a room on one,
      join by code on the other — both should show **2 / 8**.
- [ ] Start a round and confirm the other character moves.
- [ ] If joining fails: Worker → **Logs** (Observability is enabled in
      `wrangler.jsonc`) shows Durable Object errors; a `400` on `/ws` means
      a malformed room code.
- [ ] (Neon) `select count(*) from results;` increases after a finished round.
