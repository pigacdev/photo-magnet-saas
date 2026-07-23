# Billing Early-Access Offer Box Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-plan Hobby/Pro early-access banners with one full-width banner-styled offer box above the billing `<PricingTable />`, with a large seat count and explicit Hobby/Pro-only copy, fixing the broken mobile stack order.

**Architecture:** Enhance `BillingEarlyAccessProspectCallout` in place (same visibility gate). Remove `BillingEarlyAccessPlanBanners` and its CSS grid. Keep Hobby/Pro card glow. Add a light `tone` prop on `EarlyAccessFeedbackLinks` so links remain readable on the blue banner without changing the amber dashboard banner.

**Tech Stack:** Next.js App Router, React client components, existing `billing-plans.css`, Clerk `<PricingTable />` (unchanged), Node test runner for copy constants.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-23-billing-early-access-offer-box-design.md`.
- Work on branch `develop`.
- Do not replace `<PricingTable />` with `CheckoutButton` cards.
- Do not change early-access backend, seat counting, or Clerk `billing.json`.
- Keep `BillingEarlyAccessMemberBanner` and dashboard `BillingEarlyAccessBanner` behavior (amber dashboard banner stays amber).
- Visibility for the billing offer box: `status.isOpen && !status.userIsEarlyAccess` only.
- Prefer CSS classes in `billing-plans.css` for the blue offer box (match former plan-banner tokens); avoid inventing a second visual system.

---

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/earlyAccessCopy.ts` | Shared strings; add Hobby/Pro-only line; remove unused plan-banner subtext |
| `src/lib/earlyAccessCopy.test.ts` | Assert new/removed copy constants |
| `src/components/dashboard/EarlyAccessFeedbackLinks.tsx` | Optional `tone` for amber vs on-brand (white) links |
| `src/components/dashboard/BillingEarlyAccessProspectCallout.tsx` | Merged offer box UI |
| `src/app/dashboard/billing/billing-plans.css` | Offer-box styles; delete per-plan banner grid CSS; keep card glow |
| `src/app/dashboard/billing/page.tsx` | Stop rendering plan banners |
| `src/components/dashboard/BillingEarlyAccessPlanBanners.tsx` | Delete |
| `docs/CLERK-BILLING.md` | Note single offer box (not per-plan banners) |

---

### Task 1: Copy constants + unit test

**Files:**
- Modify: `src/lib/earlyAccessCopy.ts`
- Create: `src/lib/earlyAccessCopy.test.ts`
- Delete usage of: `EARLY_ACCESS_PLAN_BANNER_SUBTEXT` (constant removed in this task; component deletion is Task 4)

**Interfaces:**
- Produces:
  - `EARLY_ACCESS_HEADLINE` (unchanged string)
  - `EARLY_ACCESS_PROSPECT_BODY` (unchanged)
  - `EARLY_ACCESS_EXPECTATION` (unchanged)
  - `EARLY_ACCESS_OFFER_SCOPE = "Offer applies to Hobby and Pro plans only"` (new)
  - `EARLY_ACCESS_LAUNCH_PILL = "Launch offer"` (new; was hard-coded in plan banners)
  - Removes: `EARLY_ACCESS_PLAN_BANNER_SUBTEXT`

- [ ] **Step 1: Write the failing test**

Create `src/lib/earlyAccessCopy.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as copy from "./earlyAccessCopy";

describe("earlyAccessCopy", () => {
  it("exposes Hobby/Pro-only offer scope and launch pill", () => {
    assert.equal(
      copy.EARLY_ACCESS_OFFER_SCOPE,
      "Offer applies to Hobby and Pro plans only",
    );
    assert.equal(copy.EARLY_ACCESS_LAUNCH_PILL, "Launch offer");
  });

  it("does not export removed plan-banner subtext", () => {
    assert.equal(
      "EARLY_ACCESS_PLAN_BANNER_SUBTEXT" in copy,
      false,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/earlyAccessCopy.test.ts`

Expected: FAIL (missing exports / still has old export).

- [ ] **Step 3: Update copy module**

Replace `src/lib/earlyAccessCopy.ts` with:

```ts
/** Shared user-facing copy for the early-access launch cohort. */

export const EARLY_ACCESS_HEADLINE = "Early access — help us launch";

export const EARLY_ACCESS_PROSPECT_BODY =
  "60-day free trial on Hobby & Pro · card required";

export const EARLY_ACCESS_EXPECTATION =
  "In return, we ask you to run real events, try features, and share feedback so we can improve Magnetoo before wider launch.";

export const EARLY_ACCESS_MEMBER_BODY =
  "You're in our early access cohort — 60 days free while you test Magnetoo. Your feedback helps us validate and improve the product.";

/** Billing offer box: commercial scope (Free plan is excluded). */
export const EARLY_ACCESS_OFFER_SCOPE =
  "Offer applies to Hobby and Pro plans only";

/** Pill label on the blue billing offer box. */
export const EARLY_ACCESS_LAUNCH_PILL = "Launch offer";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/lib/earlyAccessCopy.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/earlyAccessCopy.ts src/lib/earlyAccessCopy.test.ts
git commit -m "Add early-access offer scope copy and drop plan-banner subtext."
```

---

### Task 2: Feedback links tone for on-brand surfaces

**Files:**
- Modify: `src/components/dashboard/EarlyAccessFeedbackLinks.tsx`
- Consumers unchanged until Task 3 (`tone` optional; default `"amber"`)

**Interfaces:**
- Consumes: `getSocialLinks()` (unchanged)
- Produces: `EarlyAccessFeedbackLinks({ tone?: "amber" | "onBrand" })` — default `"amber"` so dashboard + member banners need no edits

- [ ] **Step 1: Update component**

Replace `src/components/dashboard/EarlyAccessFeedbackLinks.tsx` with:

```tsx
import Link from "next/link";
import { getSocialLinks } from "@/lib/socialLinks";

type Tone = "amber" | "onBrand";

const toneClasses: Record<Tone, { text: string; link: string }> = {
  amber: {
    text: "text-sm text-amber-900/90 dark:text-amber-200/90",
    link: "font-medium text-amber-950 underline decoration-amber-700/60 underline-offset-2 hover:decoration-amber-800 dark:text-amber-100 dark:decoration-amber-300/50 dark:hover:decoration-amber-200",
  },
  onBrand: {
    text: "text-sm text-white/90",
    link: "font-medium text-white underline decoration-white/60 underline-offset-2 hover:decoration-white",
  },
};

export function EarlyAccessFeedbackLinks({
  tone = "amber",
}: {
  tone?: Tone;
}) {
  const discordLink = getSocialLinks().find((link) => link.platform === "discord");
  const classes = toneClasses[tone];

  return (
    <p className={classes.text}>
      Share feedback via{" "}
      <Link href="/dashboard/support" className={classes.link}>
        Support
      </Link>
      {discordLink ? (
        <>
          {" "}
          or{" "}
          <a
            href={discordLink.href}
            target="_blank"
            rel="noopener noreferrer"
            className={classes.link}
          >
            Discord
          </a>
        </>
      ) : null}
      .
    </p>
  );
}
```

- [ ] **Step 2: Smoke-check default callers**

Confirm these still compile without props (amber default):

- `src/components/dashboard/BillingEarlyAccessBanner.tsx`
- `src/components/dashboard/BillingEarlyAccessMemberBanner.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/EarlyAccessFeedbackLinks.tsx
git commit -m "Add onBrand tone for early-access feedback links."
```

---

### Task 3: Restyle prospect callout + CSS

**Files:**
- Modify: `src/components/dashboard/BillingEarlyAccessProspectCallout.tsx`
- Modify: `src/app/dashboard/billing/billing-plans.css`

**Interfaces:**
- Consumes: `EarlyAccessStatus`, copy constants from Task 1, `EarlyAccessFeedbackLinks` with `tone="onBrand"`
- Produces: same export `BillingEarlyAccessProspectCallout({ status })`; returns `null` when `!status.isOpen || status.userIsEarlyAccess`

- [ ] **Step 1: Rewrite callout markup**

Replace `src/components/dashboard/BillingEarlyAccessProspectCallout.tsx` with:

```tsx
"use client";

import type { EarlyAccessStatus } from "@/lib/earlyAccessUi";
import {
  EARLY_ACCESS_EXPECTATION,
  EARLY_ACCESS_HEADLINE,
  EARLY_ACCESS_LAUNCH_PILL,
  EARLY_ACCESS_OFFER_SCOPE,
  EARLY_ACCESS_PROSPECT_BODY,
} from "@/lib/earlyAccessCopy";
import { EarlyAccessFeedbackLinks } from "@/components/dashboard/EarlyAccessFeedbackLinks";

type Props = {
  status: EarlyAccessStatus;
};

export function BillingEarlyAccessProspectCallout({ status }: Props) {
  if (!status.isOpen || status.userIsEarlyAccess) return null;

  const spotsLabel =
    status.seatsRemaining === 1 ? "spot left" : "spots left";

  return (
    <div className="billing-early-access-offer-box mb-6" role="status">
      <div className="billing-early-access-offer-box-top">
        <span className="billing-early-access-offer-pill">
          {EARLY_ACCESS_LAUNCH_PILL}
        </span>
      </div>
      <p className="billing-early-access-offer-headline">
        {EARLY_ACCESS_HEADLINE}
      </p>
      <p className="billing-early-access-offer-seats">
        <span className="billing-early-access-offer-seats-count tabular-nums">
          {status.seatsRemaining}
        </span>{" "}
        <span className="billing-early-access-offer-seats-label">
          {spotsLabel}
        </span>
      </p>
      <p className="billing-early-access-offer-scope">
        {EARLY_ACCESS_OFFER_SCOPE}
      </p>
      <p className="billing-early-access-offer-body">
        {EARLY_ACCESS_PROSPECT_BODY}
      </p>
      <p className="billing-early-access-offer-body">
        {EARLY_ACCESS_EXPECTATION}
      </p>
      <div className="billing-early-access-offer-links">
        <EarlyAccessFeedbackLinks tone="onBrand" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add offer-box CSS; remove per-plan banner CSS**

In `src/app/dashboard/billing/billing-plans.css`:

1. **Delete** the entire blocks for:
   - `.billing-early-access-banner-grid`
   - `.billing-early-access-banner-spacer`
   - `.billing-early-access-plan-banner` and related (`-top`, `-title`, `-sub`, `-corner`, `--pro` variants)
   - Inside `@media (min-width: 640px)`: the rules that only exist for the banner grid / spacer / connecting banner radii via `nth-child` for early-access banners (keep card glow and feature-grid rules)

2. **Add** near the top (after `.billing-plans-layout`):

```css
/* Single full-width early-access offer box (replaces per-plan banners). */
.billing-early-access-offer-box {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid rgb(37 99 235 / 0.45);
  border-radius: 0.75rem;
  background: linear-gradient(135deg, rgb(37 99 235) 0%, rgb(29 78 216) 100%);
  color: white;
  padding: 14px 16px 16px;
  text-align: center;
  box-shadow: 0 8px 24px rgb(37 99 235 / 0.14);
}

.billing-early-access-offer-box-top {
  display: flex;
  justify-content: flex-end;
  width: 100%;
  min-height: 1.25rem;
}

.billing-early-access-offer-pill {
  display: inline-flex;
  flex-shrink: 0;
  border-radius: 9999px;
  background: rgb(245 158 11);
  color: rgb(69 26 3);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 4px 8px;
  box-shadow: 0 2px 8px rgb(245 158 11 / 0.45);
  white-space: nowrap;
}

.billing-early-access-offer-headline {
  margin: 0;
  width: 100%;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1.3;
}

.billing-early-access-offer-seats {
  margin: 4px 0 0;
  line-height: 1.1;
}

.billing-early-access-offer-seats-count {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.billing-early-access-offer-seats-label {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.billing-early-access-offer-scope {
  margin: 2px 0 0;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.95;
}

.billing-early-access-offer-body {
  margin: 0;
  max-width: 42rem;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.4;
  opacity: 0.95;
}

.billing-early-access-offer-links {
  margin-top: 4px;
}
```

3. **Keep** all `.billing-plans-layout--early-access` card-glow rules (Hobby/Pro), feature border glow, `@keyframes early-access-glow`, and reduced-motion overrides.

4. **Keep** desktop 3-column grid for Clerk cards + feature lists (unchanged).

- [ ] **Step 3: Manual visual check (local)**

Open `/dashboard/billing` with early access open (non-member):

- Offer box is blue, full width, big seat number, Hobby/Pro-only line visible
- No amber duplicate callout
- Hobby/Pro cards still glow when `billing-plans-layout--early-access` is present

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/BillingEarlyAccessProspectCallout.tsx src/app/dashboard/billing/billing-plans.css
git commit -m "Restyle billing early-access callout as a single offer box."
```

---

### Task 4: Remove plan banners from page + delete component

**Files:**
- Modify: `src/app/dashboard/billing/page.tsx`
- Delete: `src/components/dashboard/BillingEarlyAccessPlanBanners.tsx`

**Interfaces:**
- Consumes: `BillingEarlyAccessProspectCallout` only for prospect messaging
- Produces: billing page without `BillingEarlyAccessPlanBanners`

- [ ] **Step 1: Update billing page**

In `src/app/dashboard/billing/page.tsx`:

1. Remove the import of `BillingEarlyAccessPlanBanners`.
2. Remove the line `<BillingEarlyAccessPlanBanners status={earlyAccess} />` inside `.billing-plans-layout`.
3. Leave `BillingEarlyAccessProspectCallout` where it already is (above the plans layout).

The plans section should look like:

```tsx
{earlyAccess ? (
  <>
    <BillingEarlyAccessProspectCallout status={earlyAccess} />
    <BillingEarlyAccessMemberBanner
      status={earlyAccess}
      show={usage?.isOnFreeTrial ?? false}
    />
  </>
) : null}
<div
  className={`billing-plans-layout mt-4${earlyAccess?.isOpen ? " billing-plans-layout--early-access" : ""}`}
>
  <div className="clerk-pricing-table">
    <PricingTable
      for="user"
      highlightedPlan="pro"
      collapseFeatures={false}
      newSubscriptionRedirectUrl="/dashboard/billing?success=true"
      appearance={{
        elements: {
          pricingTable: "magnetoo-clerk-pricing-table",
          pricingTableCard: "magnetoo-clerk-pricing-card",
          pricingTableCardFeatures: "magnetoo-clerk-hide-features",
        },
      }}
    />
  </div>
  <BillingPlanFeatureLists
    earlyAccessOpen={earlyAccess?.isOpen ?? false}
  />
</div>
```

- [ ] **Step 2: Delete plan banners component**

Delete file: `src/components/dashboard/BillingEarlyAccessPlanBanners.tsx`

- [ ] **Step 3: Grep for leftovers**

Run:

```bash
rg "BillingEarlyAccessPlanBanners|billing-early-access-banner-grid|billing-early-access-plan-banner|EARLY_ACCESS_PLAN_BANNER_SUBTEXT" --glob "!docs/superpowers/**"
```

Expected: no matches outside historical docs under `docs/superpowers/` (spec/plan may still mention the old names).

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/billing/page.tsx
git add -u src/components/dashboard/BillingEarlyAccessPlanBanners.tsx
git commit -m "Remove per-plan early-access banners from billing page."
```

---

### Task 5: Docs + verification

**Files:**
- Modify: `docs/CLERK-BILLING.md`

- [ ] **Step 1: Update CLERK-BILLING.md**

After the existing **PricingTable UI** paragraph, add:

```markdown
**Early-access offer UI:** While seats remain, the billing page shows one full-width offer box above the table (`BillingEarlyAccessProspectCallout`) stating the Hobby/Pro-only 60-day trial and remaining spots. Per-plan banners above individual Clerk cards were removed so mobile stacking stays Free → Hobby → Pro. Hobby/Pro cards still use an early-access glow via `.billing-plans-layout--early-access`.
```

- [ ] **Step 2: Run unit tests**

Run: `node --import tsx --test src/lib/earlyAccessCopy.test.ts`

Expected: PASS

- [ ] **Step 3: Manual matrix**

| State | Expect |
|-------|--------|
| EA open, not member, mobile (under 640px) | One blue offer box → three plan cards → features; no orphan Hobby/Pro banners |
| EA open, not member, desktop | Same box above 3-col table; Hobby/Pro glow |
| EA member on trial | Member banner only; no offer box |
| EA closed | No offer box; no `--early-access` glow class |

- [ ] **Step 4: Commit**

```bash
git add docs/CLERK-BILLING.md
git commit -m "Document billing early-access single offer box UI."
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Remove per-plan banners | 4 |
| One merged box, banner styling | 3 |
| Large seats | 3 |
| Hobby/Pro only copy | 1, 3 |
| Keep card glow | 3 (preserve CSS) |
| Keep member banner | 4 (untouched) |
| No new API | — (none added) |
| CLERK-BILLING note | 5 |
| Mobile order fixed | 4 (structural) |

## Out of scope (do not implement)

- Custom plan cards + `CheckoutButton`
- Changing dashboard amber `BillingEarlyAccessBanner`
- Loyalty / seat backend / Clerk plan config
