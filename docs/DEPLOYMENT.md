# Production deployment (Railway)

Confirmed stack: **Railway** (Next.js + Express + Postgres) · **Cloudflare R2** when useful · **Clerk** · **Resend** · **Sentry** · **UptimeRobot**.

Local dual-process architecture is unchanged; see [tech-stack.md](./tech-stack.md).

---

## Architecture on Railway

| Service | Dockerfile | Role |
|---------|------------|------|
| **web** | [`Dockerfile.web`](../Dockerfile.web) | Next.js (port 3000), Clerk UI, Clerk webhooks App Router route |
| **api** | [`Dockerfile.api`](../Dockerfile.api) | Express (listens on `PORT`, Railway often `8080`), uploads, Sharp, PDF, Stripe webhook, crons |
| **Postgres** | Railway plugin | Prisma `DATABASE_URL` |

Browser → **web** → rewrites `/api/*` and `/uploads/*` → **api** (`INTERNAL_API_URL`).

Config-as-code templates: [`railway.web.toml`](../railway.web.toml), [`railway.api.toml`](../railway.api.toml).

---

## One-time Railway setup

1. Create a Railway project (prefer **EU** region if sellers/buyers are EU — GDPR).
2. Add **PostgreSQL** via **Add Plugin** (or database service) in the same environment.
3. Create **api** service from this GitHub repo:
   - **Preferred:** Settings → Build → Dockerfile path `Dockerfile.api` (or Config-as-code → `railway.api.toml`)
   - Attach a **Railway Volume** mounted at `/app/uploads` (Settings → Volumes). Do not use Docker `VOLUME` in the Dockerfile — Railway rejects it.
   - Memory: start at **1 GB** (Sharp / PDF)
   - Replicas: **1** (in-process `node-cron` duplicates on multi-replica)
   - If using Nixpacks instead of Docker: Start Command `npx prisma migrate deploy && npm run start:api`
4. Create **web** service from the same repo:
   - **Preferred:** Dockerfile path `Dockerfile.web` (or Config-as-code → `railway.web.toml`)
   - Set variables **before** the first successful build (see below). `NEXT_PUBLIC_*` and `INTERNAL_API_URL` are Docker `ARG`s — changing them requires a **rebuild**.
5. Generate Railway domains (or attach custom domain) for **web**. Optionally give **api** a private network only; web must reach api via private URL.
6. Set a **spend alert** in Railway billing.

### Critical: do not use `.env.example` localhost URLs

| Wrong (local only) | Right (Railway) |
|--------------------|-----------------|
| `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/...` | Variable **Reference** from the Postgres plugin → `DATABASE_URL` (or `${{ Postgres.DATABASE_URL }}`) |
| Missing `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Paste Clerk publishable key on **web** Variables, then **redeploy** |

`localhost` inside a Railway container is the container itself — Postgres is not there. The **api** and **web** start scripts both **exit with a clear error** if `DATABASE_URL` is empty or points at localhost.

**Symptom:** after login, UI shows “Your account could not be loaded” and web logs show `ECONNREFUSED` on `prisma.user.findFirst` / `[GET /api/auth/me]`. That means the **web** service `DATABASE_URL` is missing, points at localhost, or is otherwise unreachable — App Router `/api/auth/me` talks to Postgres on web, not only on api. Fix: web Variables → Variable Reference to Postgres → redeploy web.

### Required env — web

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Same Postgres at **runtime** (Variable Reference). Never `localhost`. Not required for image build. `DATABASE_PRIVATE_URL` is accepted as fallback. |
| `INTERNAL_API_URL` | **Build-time (rewrites) + runtime (middleware).** Private URL of api using the same port the api listens on (Railway `PORT`, often `8080`), e.g. `http://api.railway.internal:8080`. Must remain set on the web service at **runtime** — `/order` session gate calls Express over this URL (not the public app hostname). |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | **Build-time (ARG).** Required or Docker build fails. |
| `CLERK_SECRET_KEY` | Runtime (and any server routes). |
| `NEXT_PUBLIC_APP_URL` / `APP_URL` | Public `https://your-domain` (set after domain exists; rebuild web when `NEXT_PUBLIC_*` changes). |
| `NEXT_PUBLIC_API_URL` | Optional if `INTERNAL_API_URL` is set; browser uses same-origin `/api`. |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Clerk → `https://your-domain/api/webhooks/clerk` |
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_*` | Optional |
| Clerk sign-in/up URL vars | Defaults baked in Dockerfile if unset |

### Required env — api

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | **Must** be the Railway Postgres URL (Variable Reference). Never `localhost`. |
| `PORT` | Injected by Railway — do not override with `4000`. Locally use `API_PORT=4000` or `PORT=4000`. |
| `CORS_ORIGIN` | Public app origin `https://your-domain` |
| `NODE_ENV` | `production` |
| `CLERK_SECRET_KEY` | Same as web |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Used by some shared sync helpers |
| `PLATFORM_OWNER_EMAILS` | Comma-separated |
| `ENABLE_MEDIA_CLEANUP_CRON` | `true` in production |
| `ENABLE_BILLING_CRON` | `true` in production |
| `APP_URL` | Public app URL for links/emails |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Verified domain sender |
| `SENTRY_DSN` | API project or shared |
| `S3_*` | When R2 is wired (see below) |
| `STRIPE_*` | Only if legacy Stripe seller webhooks still used |
| `CLERK_PRICE_*` / `CLERK_APP_ID` / `CLERK_INSTANCE_ID` | Early-access / loyalty |
| `billing.json` | Baked into `Dockerfile.api` — keep in sync with Clerk |

Full local list: [`.env.example`](../.env.example).

### Webhooks (after public URL)

| Provider | URL |
|----------|-----|
| Clerk | `https://YOUR_DOMAIN/api/webhooks/clerk` |
| Stripe (legacy) | `https://YOUR_DOMAIN/api/stripe/webhook` (rewritten to Express) |

---

## Storage

### Near-term (required for print)

- API writes under `/app/uploads/...` (session images, rendered crops, print PDFs).
- Mount a **Railway volume** at `/app/uploads` so redeploys do not wipe media.
- Same-origin `/uploads/...` URLs work through Next rewrites without CORS.

### Cloudflare R2 (when useful)

Use existing S3 client env (R2 is S3-compatible):

```env
S3_BUCKET=magnetoo-media
S3_REGION=auto
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

1. Create R2 bucket (prefer **EU** if GDPR-sensitive).
2. Create API token with object read/write.
3. Configure **CORS** on the bucket for the app origin (canvas previews need `Access-Control-Allow-Origin` — see [DEV-WORKFLOW.md](./DEV-WORKFLOW.md)).
4. Prefer a public **r2.dev** or custom domain for object URLs (`buildS3PublicUrl`).

**Gap:** order image **render** and **print-sheet** generation still expect local `/uploads/...` paths. Keep the volume until that pipeline is S3-native. R2 is still useful for originals/banners when the code path already uploads to S3.

---

## Observability

### Sentry

1. Create Sentry projects (e.g. `magnetoo-web`, `magnetoo-api`) — free tier.
2. Set `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_DSN` on web; `SENTRY_DSN` on api.
3. Optional: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` for source maps on web build.
4. SDK is no-op when DSN is empty (safe for local default).
5. `sendDefaultPii` is off — do not log photo binaries or buyer PII into Sentry extras.

### UptimeRobot (after first public deploy)

Create free HTTP monitors (5-minute interval), alert to your email:

1. **App** — `GET https://YOUR_DOMAIN/` → expect HTTP 200
2. **API health** — `GET https://YOUR_DOMAIN/api/health` → expect HTTP 200 and JSON `status: ok`

If api is not reachable via the web rewrite, monitor the public api URL instead.

---

## Region & compliance checklist

| Item | Action |
|------|--------|
| Railway region | Prefer **EU** for EU sellers |
| R2 / Postgres | Same region preference |
| Clerk Legal | Enable acceptance — [CLERK-LEGAL-SETUP.md](./CLERK-LEGAL-SETUP.md) |
| Legal entity | Replace placeholder address in `src/lib/legalConstants.ts` (GDPR-2) |
| Resend | Verified production `From` domain — [PRODUCTION-TODOS.md](./PRODUCTION-TODOS.md) |
| Subprocessors | Keep [legal/subprocessors.md](./legal/subprocessors.md) accurate (Railway, R2, Sentry) |

---

## Post-deploy verification

1. `GET /api/health` → `{ "status": "ok", ... }`
2. **Web DB** — web deploy logs show `[web] DATABASE_URL is set` (not a localhost exit). After sign-in, `GET /api/auth/me` returns 200 (not `ECONNREFUSED` / “account could not be loaded”).
3. **EA-3 `/api/auth/me` source** — while signed in as a seller, inspect response header:
   - `X-Auth-Me-Source: next` → App Router handler wins (filesystem over `afterFiles` rewrite)
   - `X-Auth-Me-Source: express` → Express rewrite wins  
   Document which one runs; keep that implementation as source of truth (see [technical-dept.md](./technical-dept.md) EA-3).
4. **Start order (buyer)** — open a storefront (or event) entry URL → **Start order**:
   - Network: `POST /api/session/start` → 200 or 201
   - Then `GET /order` → **200** (must **not** 307 back to `/store/...` or `/event/...`)
   - Application → Cookies: `sessionId` present on the app host
   - If it still bounces: check **web** logs for `[order-session] bounce reason=...` (`timeout` | `http_status` | `bad_json` | `no_session` | `fetch_error`). Confirm web has runtime `INTERNAL_API_URL` pointing at the api private hostname + port.
5. Upload a session image; confirm file under volume and preview works.
6. Generate a Square 50×50 print PDF.
7. Confirm Clerk webhook deliveries succeed.
8. Confirm UptimeRobot green; trigger a test Sentry error in staging if needed.

---

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run start:api` | Local/prod-like API via tsx |
| `scripts/start-api.sh` | Container: reject bad `DATABASE_URL`, `prisma migrate deploy`, then API |
| `scripts/start-web.sh` | Container: reject bad `DATABASE_URL`, then Next standalone |
| `npm run build` / `npm run start` | Next (web uses standalone in Docker) |

---

## What not to do

- Do not put Magento production on **Vercel Hobby** (commercial use forbidden).
- Do not scale the API to multiple replicas without moving crons out-of-process.
- Do not omit the `/app/uploads` volume before R2-native render/print.
