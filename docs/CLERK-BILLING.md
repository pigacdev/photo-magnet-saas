# Clerk Billing setup

Apply plan and feature catalog to the linked Clerk instance:

```bash
clerk enable billing --for user
clerk config patch --file billing.json --dry-run
clerk config patch --file billing.json
```

Slugs must stay in sync with [`src/lib/planCatalog.ts`](../src/lib/planCatalog.ts).

**Note:** Order/event/storefront limits are enforced in the app (`planCatalog` + `Organization`), not as Clerk feature slugs. `print_ready_pdfs` is listed on Free only (PDFs are available on every plan). `qr_ordering` is attached on every plan (QR ordering is available on all tiers). Paid plans omit `analytics_basic` because `analytics_advanced` is attached.

**PricingTable UI:** Clerk truncates in-card features and shows "+ See all features" (not fixable with taller cards). The billing page hides Clerk's feature block and renders full lists in `BillingPlanFeatureLists` (`src/lib/billingPlanDisplay.ts`). Clerk feature attachments in `billing.json` still drive entitlements/`has()`; display copy can include limits from `planCatalog`.

If Organizations are enabled, set **Membership optional** in Clerk Dashboard so user billing checkout works.
