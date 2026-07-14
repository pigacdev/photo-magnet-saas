# Audit log reference (platform owner)

Internal runbook for looking up deletion, erasure, and DSAR-related actions. **Platform owner only** — there is no in-app UI in v1.

## Two sources of truth

Every logged action is written to **both**:

1. **Server console** — structured one-liners prefixed with `[audit]` (grep-friendly during development or if logs are shipped to a aggregator).
2. **Postgres** — durable rows in the `PrivacyAuditLog` table (use for DSAR proof and disputes).

If the DB insert fails, the console line is still emitted and an error is logged as `[audit] failed to write DB row`.

## Console log format

```
[audit] action=event_deleted actor=seller@example.com org=<organizationId> target=event:<id> metadata={"name":"…","orderCount":12}
```

Fields are omitted when empty (e.g. cron jobs may only have `action` and `metadata`).

### Grep examples

From the terminal where Express runs (`npm run dev:server`), or your log aggregator:

```bash
# All audit lines
grep '\[audit\]' 

# Specific action
grep '\[audit\] action=event_deleted'

# Everything for one seller org
grep '\[audit\].* org=<organizationId>'

# Account erasure scheduled by platform owner
grep '\[audit\] action=account_erasure_scheduled'
```

## Database queries

Connect to Postgres (psql, Supabase SQL editor, Prisma Studio: `npm run db:studio` → `PrivacyAuditLog`).

### Recent activity for a seller

```sql
SELECT "createdAt", action, "actorEmail", "targetType", "targetId", metadata
FROM "PrivacyAuditLog"
WHERE "organizationId" = '<seller-user-id>'
ORDER BY "createdAt" DESC
LIMIT 50;
```

### Find a specific deletion type

```sql
SELECT *
FROM "PrivacyAuditLog"
WHERE action = 'event_deleted'
ORDER BY "createdAt" DESC;
```

### Account erasure timeline for a seller

```sql
SELECT "createdAt", action, "actorEmail", metadata
FROM "PrivacyAuditLog"
WHERE "targetId" = '<seller-user-id>'
  AND action IN (
    'account_erasure_scheduled',
    'account_erasure_cancelled',
    'account_erasure_completed'
  )
ORDER BY "createdAt" ASC;
```

### Exports (access / portability)

```sql
SELECT *
FROM "PrivacyAuditLog"
WHERE action IN ('customer_data_exported', 'seller_data_exported')
ORDER BY "createdAt" DESC;
```

## Logged actions

| `action` | Meaning |
|----------|---------|
| `order_image_deleted` | Seller deleted one order image (GDPR) |
| `order_images_deleted` | Seller deleted all images on one order |
| `customer_images_deleted` | Seller deleted all images for a customer |
| `buyer_pii_erased` | Seller erased buyer PII (customer + order snapshots) |
| `customer_deleted` | Seller soft-deleted a CRM customer |
| `customer_data_exported` | Seller downloaded per-buyer DSAR ZIP |
| `seller_data_exported` | Seller downloaded account export |
| `event_deleted` | Seller admin soft-deleted an event |
| `storefront_deleted` | Seller admin soft-deleted a storefront |
| `account_erasure_scheduled` | Seller self-delete, platform owner, or Clerk webhook |
| `account_erasure_cancelled` | Deletion cancelled during grace period |
| `account_erasure_completed` | Hard purge after grace period (cron) |
| `legal_acceptance` | Seller accepted Terms/Privacy (or re-consent) |
| `pii_retention_run` | Automated PII anonymization cron (batch summary) |

**Actor values:** seller email, platform owner email (on `/platform` erasure), or `system:clerk` for Clerk `user.deleted` webhook.

## What is not logged (v1)

- Event/storefront shape deletes, banner removal
- Marketing email preference changes
- Routine media retention blob cleanup (non-PII)

## Related docs

- [DSAR process](./dsar-process.md) — fulfillment workflow
- [ROPA](./ROPA.md) — processing activities and retention
- Implementation: `server/src/lib/privacyAuditLog.ts` (`logAuditEvent`)

**Platform UI:** Sellers scheduled for account deletion remain visible on `/platform` with a “Deletion scheduled” badge; use the “Pending deletion” filter or open **Manage** to cancel during the grace period.
