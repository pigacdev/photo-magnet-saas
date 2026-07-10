# Clerk Billing setup

Apply plan and feature catalog to the linked Clerk instance:

```bash
clerk config pull --keys billing > billing.json
# edit billing.json (PLAPI object format — see below)
clerk config patch --file billing.json --dry-run
clerk config patch --file billing.json
```

**Format:** Clerk PLAPI expects `billing.features` and `billing.plans` as **objects keyed by slug**, not arrays. Use `publicly_visible` (not `publicly_available`) and `user_enabled` (not `billing.user.enabled`). Run `clerk config schema --keys billing` to inspect the schema. Always `config pull` first so slugs match your instance.

Slugs must stay in sync with [`src/lib/planCatalog.ts`](../src/lib/planCatalog.ts).

**Note:** Order/event/storefront limits are enforced in the app (`planCatalog` + `Organization`), not as Clerk feature slugs. `print_ready_pdfs` is listed on Free only (PDFs are available on every plan). `qr_ordering` is attached on every plan (QR ordering is available on all tiers). `vacation_mode` is Hobby+ only (Free storefronts stay always open). Paid plans omit `analytics_basic` because `analytics_advanced` is attached.

**PricingTable UI:** Clerk truncates in-card features and shows "+ See all features" (not fixable with taller cards). The billing page hides Clerk's feature block and renders full lists in `BillingPlanFeatureLists` (`src/lib/billingPlanDisplay.ts`). Clerk feature attachments in `billing.json` still drive entitlements/`has()`; display copy can include limits from `planCatalog`.

If Organizations are enabled, set **Membership optional** in Clerk Dashboard so user billing checkout works.

## Usage limits vs subscription billing

Order and event quotas (`ordersThisMonth`, `eventsCreatedThisMonth`) reset **monthly on the subscription anniversary day** (e.g. subscribed on 3 Jun → resets 3 Jul, 3 Aug, …). These counters use app-managed `Organization.currentPeriodStart/End` (~1 month).

Clerk subscription `period_start` / `period_end` is for **payment renewal only** (monthly or yearly). It is stored on `Organization.subscriptionPeriodStart/End` and exposed in the UI as “Plan renews …”. It must not drive order/event usage counters — those use app-managed `currentPeriodStart/End` (~1 month). See `src/lib/billingPeriod.ts`, `src/lib/usagePeriodAnchor.ts`, and `server/src/lib/saas.ts`.

## Early access (60-day free trials)

During launch, **Hobby** and **Pro** offer a **60-day free trial** (`free_trial_enabled` / `free_trial_days` in `billing.json`). Card is required; Clerk bills full price when the trial ends. The app tracks **20 seats**; after seat 20, trials are disabled on `hobby` / `pro` via PLAPI (plans stay public at full price).

| Slug | Visibility | Notes |
|------|------------|-------|
| `hobby` / `pro` | Public | 60-day trial while seats remain; full price after seat 20 |
| `hobby_loyalty` / `pro_loyalty` | Hidden | 20% off; `price_transition` ~2 days before trial end when `grantLifetimeDiscount` is true |

**Clerk Dashboard:** enable **Require payment method for free trials**.

**Setup:**

```bash
clerk config patch --file billing.json --dry-run
clerk config patch --file billing.json
```

Record Clerk price IDs (`cprice_*`) in `.env` for loyalty transitions. Enable billing cron with `ENABLE_BILLING_CRON=true` on the API server (loyalty transition 05:00, cleanup 06:00, heads-up 07:00 UTC).

**Platform owner:** `/platform/early-access` lists active early-access orgs and toggles lifetime discount.
