# Production todos

Items to address before production launch.

## Email

All seller-context emails (Free, Hobby, and Pro) are sent via the platform Magnetoo Resend account (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`). Customer-facing emails set `Reply-To` to the seller's `notificationEmail` on the event or storefront so replies go directly to the seller.

- [ ] **Platform `From` address for production** — Configure `RESEND_FROM_EMAIL` to a verified Magnetoo sending domain (e.g. `Magnetoo <orders@magnetoo.com>`).
- [ ] **Support ticket `To` / `From` addresses** — Currently hardcoded to `magnetooprints@gmail.com` (recipient) and `Magnetoo <onboarding@resend.dev>` (sender) via `SUPPORT_TICKET_TO` and `SUPPORT_TICKET_FROM` in `server/src/lib/email.ts`. Before production, replace with the real Magnetoo support inbox and a verified platform sending domain in Resend.

## Social media (Contact support — Free tier)

- [ ] **Social media URLs** — Set `NEXT_PUBLIC_SOCIAL_FACEBOOK_URL`, `NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL`, and `NEXT_PUBLIC_SOCIAL_DISCORD_URL` in the production environment. These links appear on the Contact support page for Free plan users. Rebuild/redeploy after changing `NEXT_PUBLIC_*` values.
