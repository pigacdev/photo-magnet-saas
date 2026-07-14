# Deletion audit logging implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dual-write all destructive seller/platform actions to `PrivacyAuditLog` and structured `[audit]` console lines; fill logging gaps for event/storefront/customer delete, exports, and Clerk webhook.

**Architecture:** Extend `logPrivacyAudit` into `logAuditEvent` with a pure `formatAuditLogLine()` for console output and tests. Add `organizationId` to the audit table. Wire call sites in route handlers and fix duplicate logs in `deleteAllCustomerImages`. No UI.

**Tech stack:** Express routes, Prisma, Node `node:test`, existing `PrivacyAuditLog` model.

**Spec:** `docs/superpowers/specs/2026-07-14-deletion-audit-logging-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `server/src/lib/privacyAuditLog.ts` | `logAuditEvent`, `formatAuditLogLine`, alias `logPrivacyAudit` |
| `server/src/lib/privacyAuditLog.test.ts` | Unit tests for log line formatting |
| `prisma/schema.prisma` | Add `organizationId` to `PrivacyAuditLog` |
| `prisma/migrations/…/migration.sql` | Column + index |
| `server/src/lib/orderImageDeletion.ts` | Suppress per-order audit when batching customer deletes |
| `server/src/routes/events.ts` | Log `event_deleted` |
| `server/src/routes/storefronts.ts` | Log `storefront_deleted` |
| `server/src/routes/customers.ts` | Log `customer_deleted`, `customer_data_exported` |
| `server/src/routes/organization.ts` | Log `seller_data_exported` |
| `src/lib/clerkUserSync.ts` | Log `account_erasure_scheduled` on Clerk delete |
| `docs/legal/dsar-process.md` | Mention `[audit]` grep |
| `docs/technical-dept.md` | Changelog |

---

### Task 1: Audit log line formatter (test-first)

**Files:**
- Create: `server/src/lib/privacyAuditLog.test.ts`
- Modify: `server/src/lib/privacyAuditLog.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/lib/privacyAuditLog.test.ts`:

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatAuditLogLine } from "./privacyAuditLog";

describe("formatAuditLogLine", () => {
  it("formats a complete audit line", () => {
    const line = formatAuditLogLine({
      action: "event_deleted",
      actorEmail: "seller@example.com",
      organizationId: "org-1",
      targetType: "event",
      targetId: "evt-1",
      metadata: { name: "Wedding", orderCount: 3 },
    });
    assert.match(line, /^\[audit\] action=event_deleted/);
    assert.match(line, /actor=seller@example.com/);
    assert.match(line, /org=org-1/);
    assert.match(line, /target=event:evt-1/);
    assert.match(line, /metadata=\{"name":"Wedding","orderCount":3\}/);
  });

  it("omits empty optional fields", () => {
    const line = formatAuditLogLine({
      action: "pii_retention_run",
      metadata: { ordersAnonymized: 5 },
    });
    assert.doesNotMatch(line, /actor=/);
    assert.doesNotMatch(line, /org=/);
    assert.doesNotMatch(line, /target=/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test server/src/lib/privacyAuditLog.test.ts`  
Expected: FAIL — `formatAuditLogLine` not exported

- [ ] **Step 3: Implement formatter and dual-write skeleton**

Replace `server/src/lib/privacyAuditLog.ts` with:

```typescript
import { Prisma } from "../../../src/generated/prisma/client";
import { prisma } from "./prisma";

export type AuditEventInput = {
  action: string;
  actorEmail?: string | null;
  organizationId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
};

function compactMetadata(metadata: Record<string, unknown> | null | undefined): string {
  if (!metadata || Object.keys(metadata).length === 0) return "";
  return JSON.stringify(metadata);
}

export function formatAuditLogLine(input: AuditEventInput): string {
  const parts = [`[audit] action=${input.action}`];
  const actor = input.actorEmail?.trim();
  if (actor) parts.push(`actor=${actor}`);
  const org = input.organizationId?.trim();
  if (org) parts.push(`org=${org}`);
  if (input.targetType && input.targetId) {
    parts.push(`target=${input.targetType}:${input.targetId}`);
  }
  const meta = compactMetadata(input.metadata);
  if (meta) parts.push(`metadata=${meta}`);
  return parts.join(" ");
}

export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  const line = formatAuditLogLine(input);
  console.info(line);

  try {
    await prisma.privacyAuditLog.create({
      data: {
        action: input.action,
        actorEmail: input.actorEmail?.trim() || null,
        organizationId: input.organizationId?.trim() || null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadata: input.metadata
          ? (input.metadata as Prisma.InputJsonValue)
          : undefined,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write DB row", input.action, err);
  }
}

/** @deprecated Use logAuditEvent — kept for existing imports */
export async function logPrivacyAudit(input: AuditEventInput): Promise<void> {
  return logAuditEvent(input);
}

export type PrivacyAuditInput = AuditEventInput;
```

Note: `organizationId` on the Prisma model comes in Task 2; TypeScript will error until then — implement Task 2 before running full server typecheck.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test server/src/lib/privacyAuditLog.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/privacyAuditLog.ts server/src/lib/privacyAuditLog.test.ts
git commit -m "feat(audit): add dual-write helper and log line formatter"
```

---

### Task 2: Schema — add organizationId

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260714140000_audit_log_organization_id/migration.sql`

- [ ] **Step 1: Update Prisma model**

In `PrivacyAuditLog` add:

```prisma
  organizationId String?

  @@index([organizationId])
```

- [ ] **Step 2: Create migration SQL**

```sql
ALTER TABLE "PrivacyAuditLog" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "PrivacyAuditLog_organizationId_idx" ON "PrivacyAuditLog"("organizationId");
```

- [ ] **Step 3: Apply migration and regenerate client**

Run:
```bash
npx prisma migrate deploy
npm run db:generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260714140000_audit_log_organization_id/
git commit -m "feat(audit): add organizationId to PrivacyAuditLog"
```

---

### Task 3: Backfill organizationId on existing call sites

**Files:**
- Modify: `server/src/lib/orderImageDeletion.ts`
- Modify: `server/src/lib/buyerPiiErasure.ts`
- Modify: `server/src/lib/accountErasure.ts`
- Modify: `server/src/routes/organization.ts`

- [ ] **Step 1: Add organizationId to each logAuditEvent/logPrivacyAudit call**

Example pattern — in `deleteSingleOrderImage`:

```typescript
await logAuditEvent({
  action: "order_image_deleted",
  actorEmail: params.actorEmail,
  organizationId: params.organizationId,
  targetType: "order_image",
  targetId: image.id,
  metadata: { orderId: params.orderId },
});
```

Apply the same `organizationId: params.organizationId` (or `userId`) to all existing audit calls in:
- `orderImageDeletion.ts` (3 calls)
- `buyerPiiErasure.ts` (1 call)
- `accountErasure.ts` (3 calls — use `params.userId` as organizationId)
- `organization.ts` legal acceptance (use `userId`)

- [ ] **Step 2: Fix duplicate customer image logs**

In `orderImageDeletion.ts`, add optional flag to `deleteAllOrderImages`:

```typescript
export async function deleteAllOrderImages(params: {
  organizationId: string;
  orderId: string;
  actorEmail?: string | null;
  reason?: string;
  suppressAuditLog?: boolean;
}): Promise<DeleteOrderImageResult> {
  // ... existing loop ...

  if (!params.suppressAuditLog) {
    await logAuditEvent({
      action: "order_images_deleted",
      actorEmail: params.actorEmail,
      organizationId: params.organizationId,
      targetType: "order",
      targetId: params.orderId,
      metadata: { count: deletedCount },
    });
  }

  return { deletedCount, errors };
}
```

In `deleteAllCustomerImages`, pass `suppressAuditLog: true` when calling `deleteAllOrderImages`; keep the single `customer_images_deleted` summary log.

- [ ] **Step 3: Verify server typecheck**

Run: `npx tsc --noEmit -p server/tsconfig.json`  
Expected: no errors in audit-related files

- [ ] **Step 4: Commit**

```bash
git add server/src/lib/orderImageDeletion.ts server/src/lib/buyerPiiErasure.ts server/src/lib/accountErasure.ts server/src/routes/organization.ts
git commit -m "feat(audit): pass organizationId and dedupe customer image logs"
```

---

### Task 4: Log event and storefront deletion

**Files:**
- Modify: `server/src/routes/events.ts`
- Modify: `server/src/routes/storefronts.ts`

- [ ] **Step 1: Event delete — fetch seller email + order count, then log**

In `eventsRouter.delete("/:id", …)` after loading `existing`, before update:

```typescript
import { logAuditEvent } from "../lib/privacyAuditLog";

// inside handler, after existing is found:
const [seller, orderCount] = await Promise.all([
  prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
  prisma.order.count({
    where: { contextType: "EVENT", contextId: id, deletedAt: null },
  }),
]);

await prisma.event.update({ where: { id }, data: { deletedAt: new Date() } });

await logAuditEvent({
  action: "event_deleted",
  actorEmail: seller?.email,
  organizationId: userId,
  targetType: "event",
  targetId: id,
  metadata: { name: existing.name, orderCount },
});
```

Remove duplicate `res.json` if update moved — keep response `{ success: true }`.

- [ ] **Step 2: Storefront delete — same pattern**

```typescript
await logAuditEvent({
  action: "storefront_deleted",
  actorEmail: seller?.email,
  organizationId: userId,
  targetType: "storefront",
  targetId: id,
  metadata: { name: existing.name, orderCount },
});
```

- [ ] **Step 3: Manual smoke test**

1. Start server, delete a test event as seller admin.
2. Grep server output for `[audit] action=event_deleted`.
3. Query DB: `SELECT * FROM "PrivacyAuditLog" WHERE action = 'event_deleted' ORDER BY "createdAt" DESC LIMIT 1;`

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/events.ts server/src/routes/storefronts.ts
git commit -m "feat(audit): log event and storefront deletion"
```

---

### Task 5: Log customer soft-delete and exports

**Files:**
- Modify: `server/src/routes/customers.ts`
- Modify: `server/src/routes/organization.ts`

- [ ] **Step 1: Customer soft-delete**

In `customersRouter.delete("/:id", …)` after soft-delete:

```typescript
import { logAuditEvent } from "../lib/privacyAuditLog";

const seller = await prisma.user.findUnique({
  where: { id: userId },
  select: { email: true },
});

await logAuditEvent({
  action: "customer_deleted",
  actorEmail: seller?.email,
  organizationId: userId,
  targetType: "customer",
  targetId: id,
  metadata: { name: existing.name },
});
```

- [ ] **Step 2: Customer export**

In `GET /:id/export.zip` handler (after successful stream setup or at start of `streamCustomerDataExport`), log:

```typescript
await logAuditEvent({
  action: "customer_data_exported",
  actorEmail: req.user email lookup,
  organizationId: userId,
  targetType: "customer",
  targetId: params.customerId,
});
```

Prefer logging in the route handler in `customers.ts` (not inside stream helper) so failed 404s are not logged.

- [ ] **Step 3: Seller account export**

In `organizationRouter.get("/export", …)` after auth, before streaming response:

```typescript
await logAuditEvent({
  action: "seller_data_exported",
  actorEmail: user.email,
  organizationId: userId,
  targetType: "user",
  targetId: userId,
});
```

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/customers.ts server/src/routes/organization.ts
git commit -m "feat(audit): log customer delete and data exports"
```

---

### Task 6: Clerk webhook erasure logging

**Files:**
- Modify: `src/lib/clerkUserSync.ts`

- [ ] **Step 1: Log when Clerk soft-deletes seller**

In `softDeleteSellerByClerkId`, after the user update:

```typescript
import { logAuditEvent } from "../../server/src/lib/privacyAuditLog";

// after prisma.user.update:
const row = await prisma.user.findUnique({
  where: { id: user.id },
  select: { email: true, erasureScheduledAt: true },
});

await logAuditEvent({
  action: "account_erasure_scheduled",
  actorEmail: "system:clerk",
  organizationId: user.id,
  targetType: "user",
  targetId: user.id,
  metadata: {
    reason: "clerk_webhook",
    email: row?.email,
    erasureScheduledAt: row?.erasureScheduledAt?.toISOString(),
  },
});
```

Use the existing `user.id` from the findFirst at the start of the function.

- [ ] **Step 2: Verify no duplicate log if route also calls scheduleSellerAccountErasure**

Clerk webhook should only hit `softDeleteSellerByClerkId` — confirm in `src/app/api/webhooks/clerk/route.ts` that it does not also call `scheduleSellerAccountErasure` (which would double-log). If it does, remove duplicate path and keep single log site.

- [ ] **Step 3: Commit**

```bash
git add src/lib/clerkUserSync.ts
git commit -m "feat(audit): log account erasure scheduled from Clerk webhook"
```

---

### Task 7: Documentation

**Files:**
- Modify: `docs/legal/dsar-process.md`
- Modify: `docs/technical-dept.md`

- [ ] **Step 1: Update DSAR process**

Under "Fulfillment steps", add:

```markdown
- **Audit lookup:** Structured server logs grep `[audit] action=…`; durable records in `PrivacyAuditLog` (filter by `organizationId`, `action`, `createdAt`).
```

- [ ] **Step 2: Update technical-dept changelog**

Add line under GDPR section:

```markdown
| 2026-07-14 | Deletion audit logging: dual-write `[audit]` console + `PrivacyAuditLog`, `organizationId` column, gaps filled (event/storefront/customer delete, exports, Clerk webhook). |
```

- [ ] **Step 3: Commit**

```bash
git add docs/legal/dsar-process.md docs/technical-dept.md
git commit -m "docs: deletion audit logging runbook and changelog"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Dual-write DB + console | Task 1 |
| `organizationId` column | Task 2 |
| Event/storefront/customer delete | Task 4, 5 |
| Export logging | Task 5 |
| Clerk webhook | Task 6 |
| Dedupe customer image logs | Task 3 |
| No UI | — (no tasks) |
| Docs | Task 7 |

No placeholders remain. All action strings match the approved design.

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-07-14-deletion-audit-logging.md`.

**Two execution options:**

1. **Subagent-driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline execution** — implement all tasks in this session with checkpoints

Which approach do you want?
