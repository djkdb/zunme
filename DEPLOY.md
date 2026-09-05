# Deploying DROPZONE — Supabase + Cloudflare

DROPZONE needs two things in production:

1. **Supabase** for the realtime room channels (Presence + Broadcast).
2. **Cloudflare Workers** to host the Next.js app (via the OpenNext adapter).

Total cost on free tiers: $0 for a friends-scale game.

---

## 1. Supabase (realtime backend)

1. Go to <https://supabase.com/dashboard> → **New project**. Pick a region
   close to your players (e.g. `ap-northeast-2` Seoul).
2. When it is ready open **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_…`) or the legacy **anon** key →
     `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Nothing else is required: no tables, no auth, no RLS. Rooms live only in
   realtime channels named `room:<CODE>`.
4. Optional, under **Project Settings → Realtime**: the default quota is
   100 messages/s. DROPZONE sends ~10 msg/s per player, so 8 players fit.
   Raise it if you increase `NET_TICK_RATE` in `src/game/config.ts`.

Test locally first:

```bash
cp .env.example .env.local     # paste the two values
npm run dev                    # open two browsers → same room code
```

> These are **public** keys by design (they only allow what the anon role
> can do, which here is joining realtime channels). Never put the
> `service_role` key in the client.

---

## 2. Cloudflare Workers (hosting)

The repo is already configured:

| File | Purpose |
| --- | --- |
| `wrangler.jsonc` | Worker name, `nodejs_compat`, static assets binding |
| `open-next.config.ts` | OpenNext Cloudflare adapter config |
| `package.json` → `preview` / `deploy` scripts | build + run locally / build + deploy |

### Option A — deploy from your machine

```bash
npx wrangler login                  # one-time, opens the browser
# NEXT_PUBLIC_* vars are inlined at BUILD time, so export them first:
export NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxx
npm run preview                     # test on http://localhost:8787
npm run deploy                      # → https://dropzone.<your-subdomain>.workers.dev
```

On Windows PowerShell use `$env:NEXT_PUBLIC_SUPABASE_URL="..."` instead of
`export`. Alternatively put the two lines in `.env.production.local` (git-
ignored) and just run `npm run deploy`.

### Option B — Git-connected (auto-deploy on push)

1. Cloudflare dashboard → **Workers & Pages → Create → Workers → Import a
   repository** → pick this repo and branch.
2. Build settings:
   - **Build command**: `npx opennextjs-cloudflare build`
   - **Deploy command**: `npx opennextjs-cloudflare deploy`
3. **Variables and Secrets** (build *and* runtime): add
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   They must be present at build time because Next.js inlines
   `NEXT_PUBLIC_*` into the client bundle.
4. Save → every push to the branch redeploys.

### Custom domain

Worker → **Settings → Domains & Routes → Add custom domain**. Cloudflare
provisions the certificate automatically. Then share
`https://your-domain.com/room/ABC123`-style links.

### Notes

- The Worker only renders the `/room/[code]` redirect logic on the server;
  the game itself is 100% client-side, so Worker CPU usage is negligible.
- `nodejs_compat` is required by the adapter. `global_fetch_strictly_public`
  is a recommended security flag.
- To enable the Next.js ISR cache later, uncomment the `r2_buckets` block in
  `wrangler.jsonc` and create the bucket with `npx wrangler r2 bucket create
  dropzone-cache`. Not needed for DROPZONE.
- Supabase's realtime endpoint is `wss://…supabase.co/realtime/v1`; no
  Cloudflare configuration is needed for it because the browser connects
  to Supabase directly, not through the Worker.

---

## 3. Checklist before sharing the link

- [ ] Open the deployed URL on a phone and a laptop, create a room on one,
      join by code on the other — both should show **2 / 8** in the lobby.
- [ ] Start a round; make sure the other player's character moves.
- [ ] Check the Supabase dashboard → **Realtime → Inspector** if a join
      fails (usually a wrong key or paused project).
