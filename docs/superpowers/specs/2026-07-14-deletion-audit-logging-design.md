# Deletion & audit logging design

**Date:** 2026-07-14  
**Status:** Approved  
**Goal:** Platform owner can prove who deleted what (DSAR, disputes) via durable DB records and grep-friendly server logs. No UI in v1.

## Context

GDPR work introduced `PrivacyAuditLog` and `logPrivacyAudit()` for image deletion, buyer PII erasure, and account erasure. Gaps remain: event/storefront/customer soft-delete, data exports, Clerk webhook erasure, and no structured console output.

## Decisions

| Topic | Decision |
|-------|----------|
| Audience | Platform owner only |
| Access | Postgres (`PrivacyAuditLog`) + structured `[audit]` console lines |
| UI / API | None in v1 |
| Approach | Extend existing helper to dual-write DB + console |

## Scope — logged actions

**Keep existing:** `order_image_deleted`, `order_images_deleted`, `customer_images_deleted`, `buyer_pii_erased`, `account_erasure_scheduled`, `account_erasure_cancelled`, `account_erasure_completed`, `legal_acceptance`, `pii_retention_run`.

**Add:**

| Action | Trigger | Actor |
|--------|---------|-------|
| `event_deleted` | `DELETE /api/events/:id` | Seller admin email |
| `storefront_deleted` | `DELETE /api/storefronts/:id` | Seller admin email |
| `customer_deleted` | `DELETE /api/customers/:id` | Seller email |
| `account_erasure_scheduled` | Clerk `user.deleted` webhook | `system:clerk` |
| `customer_data_exported` | `GET /api/customers/:id/export.zip` | Seller email |
| `seller_data_exported` | `GET /api/organization/export` | Seller email |

**Out of scope:** shape deletes, banner deletes, marketing prefs, routine media cleanup cron.

**Fix:** `deleteAllCustomerImages` must emit one summary audit row, not one per order.

## Dual-write helper

`logAuditEvent(input)` in `server/src/lib/privacyAuditLog.ts` (or renamed `auditLog.ts`):

- Inserts into `PrivacyAuditLog` (with optional `organizationId`).
- Emits one line: `[audit] action=… actor=… org=… target=type:id metadata={…}`.
- Metadata must not contain phone numbers, full addresses, or image URLs.
- On DB insert failure: log `console.error` and still emit the `[audit]` line.

`logPrivacyAudit` remains as an alias for backward compatibility.

## Schema

Add to `PrivacyAuditLog`:

- `organizationId String?` with index `@@index([organizationId])`

## Console format example

```
[audit] action=event_deleted actor=seller@example.com org=550e8400-e29b-41d4-a716-446655440000 target=event:abc123 metadata={"name":"Summer fair","orderCount":42}
```

## Query examples (platform owner)

```sql
-- All deletions for a seller org
SELECT * FROM "PrivacyAuditLog"
WHERE "organizationId" = '<org-id>'
ORDER BY "createdAt" DESC;

-- Event deletes
SELECT * FROM "PrivacyAuditLog" WHERE action = 'event_deleted';
```

Server grep:

```bash
grep '\[audit\] action=event_deleted' 
```

## Non-goals (v1)

- Platform UI for audit log
- Seller-visible audit history
- `actorUserId` column
- External log shipper configuration

## Docs updates

- `docs/legal/dsar-process.md` — reference structured `[audit]` logs
- `docs/technical-dept.md` — changelog line when complete
