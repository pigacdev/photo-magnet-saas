# Production todos

Items to address before production launch.

Full deploy runbook: [DEPLOYMENT.md](./DEPLOYMENT.md).

## Hosting / ops

- [ ] **Railway project** — web (`Dockerfile.web`) + api (`Dockerfile.api`) + Postgres; api volume at `/app/uploads`; EU region if EU sellers; spend alert.
- [ ] **Env matrix** — Copy from `.env.example` / DEPLOYMENT.md; enable `ENABLE_MEDIA_CLEANUP_CRON` and `ENABLE_BILLING_CRON` on api only.
- [ ] **Sentry** — Create projects; set `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` on web and api.
- [ ] **UptimeRobot** — Monitors for `GET /` and `GET /api/health` after public domain is live.
- [ ] **EA-3 verify** — Confirm `X-Auth-Me-Source` on `GET /api/auth/me` (`next` vs `express`).
- [ ] **Cloudflare R2** (optional v1) — Bucket + CORS + `S3_*`; keep api volume until render/print is R2-native.

## Compliance / region

- [ ] **Clerk Legal Acceptance** — [CLERK-LEGAL-SETUP.md](./CLERK-LEGAL-SETUP.md)
- [ ] **Legal entity address** — Replace placeholder in `src/lib/legalConstants.ts` (GDPR-2)
- [ ] **Subprocessors** — Keep [legal/subprocessors.md](./legal/subprocessors.md) aligned with Railway / R2 / Sentry

## Email

All seller-context emails (Free, Hobby, and Pro) are sent via the platform Magnetoo Resend account (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`). Customer-facing emails set `Reply-To` to the seller's `notificationEmail` on the event or storefront so replies go directly to the seller.

- [ ] **Platform `From` address for production** — Configure `RESEND_FROM_EMAIL` to a verified Magnetoo sending domain (e.g. `Magnetoo <orders@magnetoo.com>`).
- [ ] **Support ticket `To` / `From` addresses** — Currently hardcoded to `magnetooprints@gmail.com` (recipient) and `Magnetoo <onboarding@resend.dev>` (sender) via `SUPPORT_TICKET_TO` and `SUPPORT_TICKET_FROM` in `server/src/lib/email.ts`. Before production, replace with the real Magnetoo support inbox and a verified platform sending domain in Resend.

## Social media (Contact support)

- [ ] **Social media URLs** — Set `NEXT_PUBLIC_SOCIAL_FACEBOOK_URL`, `NEXT_PUBLIC_SOCIAL_DISCORD_URL`, and `NEXT_PUBLIC_SOCIAL_YOUTUBE_URL` in the production environment. These links appear on the Contact support page (and in the dashboard sidebar). Rebuild/redeploy after changing `NEXT_PUBLIC_*` values.
