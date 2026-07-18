# Platform seller alert emails + Notifications settings

**Date:** 2026-07-18  
**Status:** Approved  
**Goal:** Email every address in `PLATFORM_ALERT_EMAILS` when a new seller registers and when a seller’s product plan changes (`FREE` / `HOBBY` / `PRO`), with global on/off toggles on `/platform/notifications`.

## Product decisions

| Topic | Decision |
|-------|----------|
| New-user trigger | On new `User` row create only (Clerk `user.created` → `ensureSellerUser`); not `user.updated` / email-link |
| Plan-change trigger | When `Organization.plan` enum changes; any Free↔Hobby↔Pro including downgrades and paid→Free lapse |
| Loyalty / slug-only | No alert when only Clerk plan slug changes (e.g. `hobby` → `hobby_loyalty`) |
| Recipients | `PLATFORM_ALERT_EMAILS` (comma-separated); no fallback to `PLATFORM_OWNER_EMAILS` |
| Empty recipients | Skip send; `console.warn` |
| Preferences | Global singleton toggles: New users / Subscription plan changes |
| Defaults | Both **on** until changed |
| Preference scope | Same filter for every alert recipient |
| Failure mode | Fail-soft: log Resend errors; never fail webhook, user create, or billing sync |
| Branch | All work on `develop` (not `main`) |

## Architecture

Central alert helper + existing sync choke points:

1. **New user:** `ensureSellerUser` creates User + Organization → if `newUserAlertsEnabled` and recipients exist → Resend.
2. **Plan change:** `applyPaidPlan` / `revertToFreePlan` update org → if previous `plan` ≠ new `plan` and `planChangeAlertsEnabled` → Resend.
3. **Settings UI:** `/platform/notifications` (nav under Early access) → GET/PATCH singleton `PlatformAlertSettings`.

```text
Clerk user.created → ensureSellerUser (create) → new_user alert (if enabled)
Billing sync → applyPaidPlan / revertToFreePlan → plan_change alert (if plan enum changed)
/platform/notifications → PlatformAlertSettings → gates both sends
PLATFORM_ALERT_EMAILS → Resend (transactional)
```

## Data

### `PlatformAlertSettings` (singleton, `id = 1`)

| Column | Type | Default |
|--------|------|---------|
| id | int | 1 |
| newUserAlertsEnabled | boolean | true |
| planChangeAlertsEnabled | boolean | true |
| updatedAt | datetime | auto |

Ensure row on first read/write (upsert), same pattern as `EarlyAccessCounter`.

### Env

| Variable | Purpose |
|----------|---------|
| `PLATFORM_ALERT_EMAILS` | Comma-separated alert recipients |
| `PLATFORM_OWNER_EMAILS` | Unchanged — dashboard allowlist only |

## Emails

| Kind | Subject (approx.) | Body includes |
|------|-------------------|---------------|
| New user | New Magnetoo seller registered | Name, email, user id, link to `/platform` |
| Plan change | Magnetoo seller plan changed | Name, email, user id, `fromPlan → toPlan`, link to `/platform` |

- From: platform From (`RESEND_FROM_EMAIL` / existing helper)
- Classification: transactional
- Send to each address in `PLATFORM_ALERT_EMAILS` individually (or multi-`to` if Resend helper already supports it — match existing multi-recipient patterns)

## API

Owner-gated (same as other `/api/platform/*` routes):

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/api/platform/notifications/settings` | Return both toggles (ensure singleton exists) |
| PATCH | `/api/platform/notifications/settings` | Update one or both toggles |

Avoid colliding with existing `POST /api/platform/notifications/send`.

## UI

- Nav item **Notifications** after Early access → `/platform/notifications`
- Two rows: “New users”, “Subscription plan changes”, each with on/off control
- Helper text: recipients come from `PLATFORM_ALERT_EMAILS`
- Match existing platform page styling (e.g. early-access)

## Call sites

| Location | When to notify |
|----------|----------------|
| `src/lib/clerkUserSync.ts` → `ensureSellerUser` | After successful **create** of User (+ Organization) |
| `src/lib/clerkBillingSync.ts` → `applyPaidPlan` | After update when `plan` enum changed |
| `src/lib/clerkBillingSync.ts` → `revertToFreePlan` | After successful paid→Free transition (plan changed) |

## Error handling

- Missing/empty `PLATFORM_ALERT_EMAILS`: skip + warn
- Toggle off: skip silently
- Resend failure: log; do not throw into Clerk webhook or billing sync
- Same plan re-applied: no plan-change email

## Testing

- Recipient parsing from env
- Prefs gate (off → no send)
- Plan-change only when `Plan` enum changes; not loyalty slug-only
- New-user alert only on create, not update/link
- Settings GET/PATCH owner-gated (lightweight)

## Out of scope

- Per-recipient preferences
- Digests / batching
- In-app notification inbox
- Fallback to `PLATFORM_OWNER_EMAILS`
- Merging `develop` → `main` (explicit follow-up)
