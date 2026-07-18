# Platform Seller Alert Emails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Email every `PLATFORM_ALERT_EMAILS` address on new seller create and on product plan changes, with global on/off toggles at `/platform/notifications`.

**Architecture:** Singleton `PlatformAlertSettings` gates two Resend alert helpers. Call sites are `ensureSellerUser` (create only) and `applyPaidPlan` / `revertToFreePlan` (when `Organization.plan` enum changes). Platform GET/PATCH settings + Notifications UI under Early access.

**Tech Stack:** Prisma, Resend (`server/src/lib/email.ts`), Clerk webhooks, Next.js platform routes, Express `platformRouter`.

## Global Constraints

- Work only on branch `develop`.
- Recipients from `PLATFORM_ALERT_EMAILS` only; empty → skip + warn; no fallback to `PLATFORM_OWNER_EMAILS`.
- Plan alerts use product enum (`FREE`/`HOBBY`/`PRO`), not Clerk loyalty slugs.
- Fail-soft: never throw email errors into webhook/billing sync.
- Spec: `docs/superpowers/specs/2026-07-18-platform-seller-alert-emails-design.md`.

---

## File map

| File | Responsibility |
|------|----------------|
| `prisma/schema.prisma` + migration | `PlatformAlertSettings` singleton |
| `server/src/lib/platformAlertSettings.ts` | Load/update settings; parse alert emails |
| `server/src/lib/platformSellerAlerts.ts` | Orchestrate gated sends |
| `server/src/lib/email.ts` | HTML builders + send helpers |
| `src/lib/clerkUserSync.ts` | Fire new-user alert after create |
| `src/lib/clerkBillingSync.ts` | Fire plan-change alert when plan enum changes |
| `server/src/routes/platform.ts` | GET/PATCH `/notifications/settings` |
| `src/app/api/platform/notifications/settings/route.ts` | Next proxy (owner-gated) |
| `src/lib/platformApi.ts` | Client fetch/patch helpers |
| `src/components/platform/platformNav.ts` | Nav item |
| `src/components/dashboard/dashboardNavIcons.tsx` | Optional bell icon |
| `src/app/platform/notifications/page.tsx` | Toggles UI |
| `docs/database-schema.md`, `docs/DEPLOYMENT.md` | Docs |
| `*.test.ts` | Unit tests |

---

### Task 1: Schema + docs

- [ ] Add `PlatformAlertSettings` model (`id=1`, both bools default true, `updatedAt`)
- [ ] Add migration `20260718120000_platform_alert_settings`
- [ ] Seed row `id=1` in migration SQL
- [ ] Update `docs/database-schema.md` and `docs/DEPLOYMENT.md` (`PLATFORM_ALERT_EMAILS`)
- [ ] `npx prisma generate`

### Task 2: Settings + email helpers + tests

- [ ] `getPlatformAlertEmails()`, `getPlatformAlertSettings()`, `updatePlatformAlertSettings()`
- [ ] `buildPlatformNewUserAlertHtml` / `sendPlatformNewUserAlert`
- [ ] `buildPlatformPlanChangeAlertHtml` / `sendPlatformPlanChangeAlert`
- [ ] `notifyPlatformNewUser` / `notifyPlatformPlanChange` (gate prefs + recipients; catch errors)
- [ ] Unit tests: env parse, prefs off, HTML contains key fields

### Task 3: Wire call sites

- [ ] `ensureSellerUser`: after new user create, fail-soft `notifyPlatformNewUser`
- [ ] `applyPaidPlan`: read previous plan; after update, if changed → `notifyPlatformPlanChange`
- [ ] `revertToFreePlan`: after successful paid→Free, also `notifyPlatformPlanChange` (in addition to seller lapse email)

### Task 4: API + UI

- [ ] Express + Next GET/PATCH `/api/platform/notifications/settings`
- [ ] `platformApi` helpers
- [ ] Nav **Notifications** after Early access → `/platform/notifications`
- [ ] Page with two switches matching early-access toggle style

### Task 5: Verify

- [ ] Run focused unit tests
- [ ] Commit implementation on `develop`

---

## Manual test (after deploy/local)

1. Set `PLATFORM_ALERT_EMAILS` to your inbox; leave toggles default on.
2. Create a test Clerk user → expect new-user email.
3. Move org Free→Hobby (or via billing) → expect plan-change email.
4. Turn off “New users” → create another user → no email; plan change still emails.
5. Clear `PLATFORM_ALERT_EMAILS` → warns in logs, no send.
