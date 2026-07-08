# Clerk Billing setup

Apply plan and feature catalog to the linked Clerk instance:

```bash
clerk enable billing --for user
clerk config patch --file billing.json --dry-run
clerk config patch --file billing.json
```

Slugs must stay in sync with [`src/lib/planCatalog.ts`](../src/lib/planCatalog.ts).

**Note:** Order/event/storefront limits are enforced in the app (`planCatalog` + `Organization`), not as Clerk feature slugs. `print_ready_pdfs` is listed on Free only (PDFs are available on every plan). `qr_ordering` is attached on every plan (QR ordering is available on all tiers). `vacation_mode` is Hobby+ only (Free storefronts stay always open). Paid plans omit `analytics_basic` because `analytics_advanced` is attached.

**PricingTable UI:** Clerk truncates in-card features and shows "+ See all features" (not fixable with taller cards). The billing page hides Clerk's feature block and renders full lists in `BillingPlanFeatureLists` (`src/lib/billingPlanDisplay.ts`). Clerk feature attachments in `billing.json` still drive entitlements/`has()`; display copy can include limits from `planCatalog`.

If Organizations are enabled, set **Membership optional** in Clerk Dashboard so user billing checkout works.

## Usage limits vs subscription billing

Order and event quotas (`ordersThisMonth`, `eventsCreatedThisMonth`) reset **monthly on the subscription anniversary day** (e.g. subscribed on 3 Jun → resets 3 Jul, 3 Aug, …). These counters use app-managed `Organization.currentPeriodStart/End` (~1 month).

Clerk subscription `period_start` / `period_end` is for **payment renewal only** (monthly or yearly). It is stored on `Organization.subscriptionPeriodStart/End` and exposed in the UI as “Plan renews …”. It must not drive order/event usage counters — those use app-managed `currentPeriodStart/End` (~1 month). See `src/lib/billingPeriod.ts`, `src/lib/usagePeriodAnchor.ts`, and `server/src/lib/saas.ts`.
