# Technical debt register

Living document for known risks, gaps, and follow-up work. Add new sections as other areas of the application are reviewed.

## Agent obligations

- **Before implementing** a new feature or fixing existing behavior: read this file (and the relevant section) so known risks, launch blockers, and prior decisions are in context.
- **When resolving** an item: update this file in the **same** commit/PR — mark the row resolved (with date and brief note), remove it if fully obsolete, or re-rank if priority changed; add a line to **Changelog** at the bottom.
- **When discovering** new debt during implementation: add a row under the appropriate section (or **Other application areas**).

Referenced from `CLAUDE.md`, `docs/AI-RULES.md`, and `docs/DEV-WORKFLOW.md`.

**How to use this file**

- Each item should state *what*, *why it matters*, and *suggested action*.
- Prefer **Must verify/fix before…** for launch- or revenue-blocking items tied to a specific feature flag or rollout step.
- Re-rank items when new evidence appears (deploy tests, incidents, support tickets).

---

## Early access & billing

Context: 60-day free trials on Hobby/Pro for the first 20 sellers; optional platform-owner `grantLifetimeDiscount` → loyalty pricing via Clerk `price_transition`. See [`CLERK-BILLING.md`](./CLERK-BILLING.md).

### Must verify/fix before enabling `grantLifetimeDiscount` in production

These block turning on the lifetime-discount feature with confidence. Everything in later sections can ship for the core trial/seat flow; **do not rely on loyalty pricing until these are closed.**

| ID | Item | Risk | Action |
|----|------|------|--------|
| EA-1 | **Loyalty cron may not see trialing subscription items** | `fetchActiveSubscriptionItem()` in `src/lib/clerkBillingAdmin.ts` only matches `active` or `past_due`, not `free_trial` / `trialing`. The loyalty job (`runEarlyAccessLoyaltyTransitionJob`) runs ~2 days before trial end, when the item is likely still trialing. If Clerk does not surface trialing items as `active`, **`grantLifetimeDiscount` is effectively a no-op** — the toggle sets a DB flag the cron never acts on. Silent failure via logged warnings on a revenue-affecting job. | **Launch-blocking for discount feature.** Write an integration test that runs `runEarlyAccessLoyaltyTransitionJob` (or `fetchActiveSubscriptionItem`) against a **real sandbox trialing** subscription item, not only mocks. Fix item selection to include trial statuses if needed. |
| EA-2 | **Price transition timing during an active trial** | Loyalty cron calls Clerk `price_transition` while the subscription may still be trialing, assuming the first *paid* charge uses the discounted price and nothing bills immediately. If transition triggers **immediate proration/charge**, EU sellers could see an unexpected background charge ~2 days early, with 3DS/SCA possibly failing on an unauthenticated session. | **Verify in Clerk sandbox** on a trialing item: confirm transition is deferred to trial end (or first paid period), not an instant charge. Adjust timing or API usage if Clerk bills immediately. |
| EA-3 | **`/api/auth/me` — which implementation actually runs?** | Two handlers exist: Express `server/src/routes/auth.ts` and Next.js `src/app/api/auth/me/route.ts`. `next.config.ts` rewrites `/api/*` to Express in **`afterFiles`**, but **filesystem App Router routes typically take precedence over `afterFiles` rewrites**. If the Next route wins, production may be serving the Next handler, not Express — the “keep in sync” note understates the risk; they may **already diverge** (e.g. `earlyAccess` on one side only). The “orphan” `src/app/api/billing/early-access-status/route.ts` may likewise be **live**, not dead, if Next routes win. | **Five-minute empirical check:** add a distinguishing log line or response header in each implementation, hit `/api/auth/me` (and `/api/billing/early-access-status`) in the deployed environment, confirm which answers. Then either delete/consolidate duplicates or document a single source of truth. |

### General hardening — higher priority (post-trial launch OK; fix soon)

| ID | Item | Risk | Action |
|----|------|------|--------|
| EA-4 | **Billing cron off by default** | `ENABLE_BILLING_CRON=false` in `.env.example`. Without `ENABLE_BILLING_CRON=true` on the API server: no heads-up emails, no loyalty transitions, no post-expiry cleanup. Easy to miss in deploy. | Document in runbooks; enforce in production env; consider startup warning if early-access orgs exist and cron is disabled. |
| EA-5 | **Webhook + `/api/auth/me` double-entry race on signup** | `applyEarlyAccessSignup()` is invoked from **webhooks** and **`syncOrganizationBillingFromClerk` on `/api/auth/me`**. After checkout, webhook delivery is not instant; a user opening the dashboard can trigger sync concurrently. Idempotency is **read-then-write** (`findUnique` → `if (org?.isEarlyAccess) return` → `incrementEarlyAccessSeat()`), **not** an atomic `UPDATE … WHERE isEarlyAccess = false`. Two concurrent calls can both pass the read before either commits → **seat counter double-increment for one org** (distinct from the seat-19/20 concurrency race). | Use a single conditional update or DB transaction/unique constraint (e.g. only increment seat when flipping `isEarlyAccess` from false to true in one atomic step). Add a test for concurrent signup paths. |
| EA-6 | ~~**Cancel during trial — stale platform listing**~~ | ~~`revertToFreePlan()` does not clear `isEarlyAccess` / `earlyAccessExpiresAt`.~~ **Resolved 2026-07-15:** `revertToFreePlan()` now clears early-access flags immediately on paid→free downgrade; lapse email sent via shared path. Platform list excludes cancelled orgs once flags are cleared. | — |
| EA-7 | **No audit trail on `grantLifetimeDiscount`** | Manual, judgment-based decision per seller. No record of who toggled or when. | Log platform owner email + timestamp on PATCH; optional `EarlyAccessAudit` table if disputes matter later. Cheap now, useful for cohort review. |

### General hardening — medium priority

| ID | Item | Risk | Action |
|----|------|------|--------|
| EA-8 | **Seat counter never decrements** | Intentional scarcity: cancelled trials still consume a seat. Ops implication: 20 is a lifetime launch cap, not “20 concurrent trials.” | Document for support/ops; revisit only if product wants seat refill on cancel. |
| EA-9 | **Seat 19/20 concurrency** | Atomic `incrementEarlyAccessSeat()` prevents two orgs qualifying for the same seat number, but concurrent signups can push `seatsTaken` slightly above 20. Only first 20 get `isEarlyAccess`. | Acceptable for launch; monitor `EarlyAccessCounter.seatsTaken` vs org count if investigating discrepancies. |
| EA-10 | **`CLERK_PRICE_*` env drift** | Loyalty transitions depend on `CLERK_PRICE_HOBBY`, `CLERK_PRICE_PRO`, `CLERK_PRICE_HOBBY_LOYALTY`, `CLERK_PRICE_PRO_LOYALTY` matching live Clerk `cprice_*` IDs. Mismatch → transitions fail with console warnings only. | Validate on deploy; script or health check that compares env to Clerk API. |
| EA-11 | **`setEarlyAccessPlansClosed` reads `billing.json` from disk** | Seat-20 flip PATCHes Clerk using local `billing.json`. Fragile if production API container lacks the file or it diverges from Clerk. | Ensure `billing.json` is deployed with API server, or patch from pulled Clerk config instead of repo file. |
| EA-12 | **Trial countdown UI vs Clerk** | Header badge uses `earlyAccessExpiresAt` from DB, not live Clerk subscription. Usually aligned via webhooks; can drift if sync fails. | Optional: surface Clerk `period_end` in usage payload or refresh on billing page. |

### General hardening — lower priority

| ID | Item | Risk | Action |
|----|------|------|--------|
| EA-13 | **Duplicate `/api/auth/me` maintenance** | After EA-3 is resolved, either remove the unused handler or generate one from the other. Until then, every auth/me change needs dual review. | Consolidate to one implementation once precedence is known. |
| EA-14 | **Orphan or ambiguous API routes** | `src/app/api/billing/early-access-status/route.ts` may be unused (client reads `earlyAccess` from `/api/auth/me`) or may be live depending on EA-3. Express has no matching route for that path if rewrites win. | Delete or add Express parity after EA-3; remove `fetchEarlyAccessStatus` indirection if redundant. |

---

## Other application areas

*(Add new subsections here — e.g. image processing, orders, auth, platform dashboard.)*

---

## Image processing / print templates

Context: only `Square 50x50 mm` (2x2 in) has a physically validated print template — it runs the hand-tuned octagon path `drawLegacySquare50Slot` in `server/src/lib/generatePrintSheet.ts` and has been verified on the owner's 2x2 in cutter. The other 3 catalog shapes use the generalized `drawShapeAwareSlot`, whose corner chamfer (`cut = mm(31)/sqrt2`) is derived from the square and applied to any size — an educated guess, not a validated cut path. There is currently no equipment anywhere reachable to physically validate them.

Guardrails in place (2026-07-14): shapes carry `productionValidated` in `src/lib/shapePresets.ts`; only validated shapes are selectable in the seller UI (others show "Coming soon"); the API rejects non-validated shapes (`server/src/lib/validatedShapes.ts` enforced in `events.ts` + `storefronts.ts`); `generatePrintSheet` refuses non-validated shapes and the orders print routes return a clean 400. Data hygiene: `npm run db:remove-unvalidated-shapes -- --apply`.

### Must validate before offering each shape

| ID | Item | Risk | Action |
|----|------|------|--------|
| PRINT-1 | **Square 63x63 mm template unvalidated** | Generalized chamfer is a guess; cut guide may not match any real die at this size → wasted materials, broken trust. | Physically validate on a 63 mm square cutter, then set `productionValidated: true` in `src/lib/shapePresets.ts` + add its key to `PRODUCTION_VALIDATED_SHAPE_KEYS` in `server/src/lib/validatedShapes.ts`. |
| PRINT-2 | **Circle 57 mm template unvalidated** | Circle bleed ring + vector clip + curved brand label unverified against a real 2.25 in circular cutter. | Physically validate, then flip both allowlists as above. |
| PRINT-3 | **Rectangle 50×76 mm template unvalidated** | Chamfered-rectangle frame with square-derived corner cut unverified against a real 2×3 in die. | Physically validate, then flip both allowlists as above. |

---

## GDPR / privacy

Context: GDPR compliance work (legal pages, consent, DSAR/erasure, retention). See `docs/legal/` and public routes `/privacy`, `/terms`, `/cookies`. **Audit lookup:** [docs/legal/audit-log.md](./legal/audit-log.md).

| ID | Item | Risk | Action |
|----|------|------|--------|
| GDPR-1 | **Clerk Legal Acceptance must be enabled in Dashboard** | Sign-up may not capture contractual agreement until Clerk legal URLs are configured | Follow [docs/CLERK-LEGAL-SETUP.md](./CLERK-LEGAL-SETUP.md) before production |
| GDPR-2 | **Legal entity address in code is placeholder** | `LEGAL_ENTITY.address` in `src/lib/legalConstants.ts` must match registered business before launch | Update constants + Privacy/Imprint pages |
| GDPR-3 | **Customer ZIP export via `<a href>`** | Export link in CRM modal may fail without auth header in some browsers | Prefer authenticated fetch (same as account export) if reported |
| GDPR-4 | **Storefront media retention** | Storefront orders have no auto media expiry policy yet | Implement when product defines storefront lifecycle |

**Resolved in 2026-07-14 GDPR implementation:** legal pages/footer, checkout consent, seller re-consent gate, cookie notice, buyer PII erasure + export, image deletion (3 scopes), account erasure with grace period, platform owner danger zone, PII retention cron, email legal footers, audit log table, `PAID_ELIGIBLE_STATUS` cleanup bug.

**Resolved 2026-07-14 (deletion audit logging):** dual-write `[audit]` console lines + `PrivacyAuditLog`, `organizationId` column, logging for event/storefront/customer delete, data exports, Clerk webhook erasure; deduped customer image batch logs.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-15 | Shape catalog: Circle 50×50 → 57×57 mm (2.25 in round); Rectangle 50×70 → 50×76 mm (2×3 in). Both remain coming soon until physical cut validation. |
| 2026-07-15 | Subscription lapse: `revertToFreePlan()` resets usage counters, clears early-access flags (EA-6 resolved), sends transactional lapse email; legacy Stripe uses shared path. |
| 2026-07-15 | Grace-period login: sellers with scheduled account deletion can sign in again (no P2002); cancel-deletion audit logging unchanged. |
| 2026-07-14 | Print templates: restricted early-access catalog to validated Square 2x2 in; added PRINT-1..3 debt + guardrails (UI/API/print-gen) and `db:remove-unvalidated-shapes`. |
| 2026-07-14 | Platform Overview: pending-erasure sellers stay visible with badge + filter; cancel via Manage. |
| 2026-07-14 | Deletion audit logging: dual-write `[audit]` console + `PrivacyAuditLog`, `organizationId`, gaps filled (event/storefront/customer delete, exports, Clerk webhook). |
| 2026-07-14 | GDPR/privacy section + implementation changelog. |
| 2026-07-10 | Initial early-access & billing debt register (review + re-rank). |
