# Production todos

Items to address before production launch.

## Email

- [ ] **Buyer confirmation `From` address** — Currently all buyer order confirmation emails are sent from the hardcoded Resend test address `Magnetoo <onboarding@resend.dev>` (`TEST_EMAIL_FROM` in `server/src/lib/email.ts`). Before production, switch to the seller’s configured `notificationEmail` on the event or storefront (display name = context name, `replyTo` = same address). Requires a verified sending domain in Resend.
- [ ] **Support ticket `To` / `From` addresses** — Currently hardcoded to `magnetooprints@gmail.com` (recipient) and `Magnetoo <onboarding@resend.dev>` (sender) via `SUPPORT_TICKET_TO` and `SUPPORT_TICKET_FROM` in `server/src/lib/email.ts`. Before production, replace with the real Magnetoo support inbox and a verified platform sending domain in Resend (e.g. move to env vars `SUPPORT_EMAIL` and `RESEND_FROM_EMAIL`).
