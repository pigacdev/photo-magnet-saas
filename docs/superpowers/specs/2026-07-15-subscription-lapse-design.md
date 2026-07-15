# Subscription lapse — seller access & notification

**Date:** 2026-07-15  
**Status:** Implemented  
**Goal:** When a paid subscription ends, sellers downgrade to Free (not locked out), receive a transactional email, and docs clearly describe post-lapse order access.

## Product decisions

| Topic | Decision |
|-------|----------|
| Lapse model | Downgrade to Free — no read-only grace, no hard lockout |
| Order access | View all orders, print PDFs, event ZIP exports (within retention) |
| Restricted on Free | CSV export, Customers CRM, Hobby+ features |
| New activity | Capped at 10 orders/month, 1 event/month |
| Notification | Transactional email on paid→free transition |
| UX scope | Email + docs only (no dashboard banner in v1) |

## Behavior

When Clerk reports subscription cancel/end/expiry (or legacy Stripe `subscription.deleted`), `revertToFreePlan()` in `src/lib/clerkBillingSync.ts`:

1. Atomically downgrades orgs on HOBBY/PRO to Free (`updateMany` for idempotency)
2. Resets `ordersThisMonth` and `eventsCreatedThisMonth` to 0
3. Clears `isEarlyAccess` and `earlyAccessExpiresAt` (keeps `grantLifetimeDiscount`)
4. Clears Clerk/Stripe subscription IDs and payment period fields
5. Sets `subscriptionLapseNotifiedAt` and sends lapse email once per transition

On resubscribe, `applyPaidPlan()` clears `subscriptionLapseNotifiedAt`.

**`past_due`:** Paid entitlements remain until explicit cancel/expired webhook.

## Email

- Template: `buildSubscriptionLapseHtml` / `sendSubscriptionLapseEmail` in `server/src/lib/email.ts`
- Subject: *Your Magnetoo subscription has ended*
- Classification: transactional (not subject to marketing opt-out)
- Content: previous plan name, retained access (orders/print/ZIP), Free limits, billing CTA

## Files changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | `subscriptionLapseNotifiedAt` on Organization |
| `src/lib/clerkBillingSync.ts` | Hardened exported `revertToFreePlan`, `buildFreePlanRevertPayload` |
| `server/src/lib/email.ts` | Lapse email template + sender |
| `server/src/routes/stripe.ts` | Delegates to shared `revertToFreePlan` |
| `src/lib/subscriptionLapse.test.ts` | Unit tests for payload + email HTML |
| Legal/docs | Terms, CLERK-BILLING.md, database-schema.md, billing page copy |
| `docs/technical-dept.md` | EA-6 resolved, changelog |

## Testing

- `buildFreePlanRevertPayload` resets counters and clears EA flags
- `isPaidOrganizationPlan` identifies HOBBY/PRO
- `buildSubscriptionLapseHtml` includes access and limit copy

## Out of scope

- Dashboard lapse banner / past_due warning UI
- Time-limited download windows
- Hard lockout or read-only grace period
