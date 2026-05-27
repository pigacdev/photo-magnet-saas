# Production todos

Items to address before production launch.

## Email

- [ ] **Buyer confirmation `From` address** — Currently all buyer order confirmation emails are sent from the hardcoded Resend test address `Magnetoo <onboarding@resend.dev>` (`TEST_EMAIL_FROM` in `server/src/lib/email.ts`). Before production, switch to the seller’s configured `notificationEmail` on the event or storefront (display name = context name, `replyTo` = same address). Requires a verified sending domain in Resend.
