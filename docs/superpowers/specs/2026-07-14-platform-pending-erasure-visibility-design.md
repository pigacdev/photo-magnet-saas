# Platform pending erasure visibility design

**Date:** 2026-07-14  
**Status:** Approved (A + D)  
**Goal:** Platform owner can see sellers scheduled for account deletion in the Overview table, filter to them, and reach Manage/cancel without losing visibility after `account_erasure_scheduled`.

## Problem

Scheduling erasure sets `User.deletedAt` immediately (soft-delete) plus `erasureScheduledAt` (grace purge date). `fetchPlatformTenants` filters `deletedAt: null`, so pending sellers vanish from `/platform` although cancel UI exists on `/platform/tenants/[id]`.

## Decisions

| Topic | Decision |
|-------|----------|
| List visibility | Include active sellers **and** users with `erasureScheduledAt != null` in default tenant query |
| Badge (A) | Status column shows “Deletion scheduled · {date}” when `erasureScheduledAt` is set |
| Filter (D) | New usage filter `erasurePending` + KPI chip to toggle (same pattern as near-order-limit) |
| KPI `totalSellers` | Unchanged — counts only `deletedAt: null` (truly active) |
| New KPI | `pendingErasure` count — users with `erasureScheduledAt != null` |
| Detail page | No change — cancel already on `/platform/tenants/[id]` |
| Hard-purged users | Removed from DB — correctly absent from list |

## Backend

### `fetchPlatformTenants` (`server/src/lib/platformMetrics.ts`)

**Default `where` (no erasure filter):**

```typescript
OR: [
  { deletedAt: null },
  { erasureScheduledAt: { not: null } },
]
```

Plus existing search `OR` on email/name (nested AND).

**When `usageFilter === "erasurePending"`:**

```typescript
{ erasureScheduledAt: { not: null } }
```

**Select/add to row payload:**

- `erasureScheduledAt: Date | null`
- `deletedAt: Date | null` (optional, for future; not required in UI v1)

### `fetchPlatformOverview`

Add:

```typescript
pendingErasure: prisma.user.count({
  where: { erasureScheduledAt: { not: null } },
})
```

### API surface

- `GET /api/platform/tenants?usageFilter=erasurePending`
- Extend `PlatformOverview` and `PlatformTenant` types in `src/lib/platformApi.ts`

## Frontend (`src/app/platform/page.tsx`)

1. **KPI card** — “Pending deletion” with count; click toggles `erasurePending` filter (reuse `UsageFilterCard` pattern).
2. **Status column** — priority:
   - If `erasureScheduledAt` → red/amber badge with formatted purge date
   - Else if `!onboardingComplete` → “Setup pending”
   - Else → “Active”
3. **Row affordance** — optional subtle `bg-amber-50/50 dark:bg-amber-950/20` when pending (minimal visual scan).
4. **Manage link** — unchanged; works for pending sellers.

## Non-goals

- Cancel from table row (detail page only)
- Seller-facing platform changes
- Changing soft-delete semantics (still immediate block on schedule)

## Testing

- Schedule erasure from tenant detail → seller remains in table with badge
- Toggle “Pending deletion” filter → only pending rows
- Cancel on detail → badge gone, seller shows Active again
- Audit log unchanged
