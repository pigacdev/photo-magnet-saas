# Platform pending erasure visibility — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Keep sellers visible on `/platform` after erasure is scheduled; show badge + filter for pending deletion.

**Architecture:** Widen tenant list query to include `erasureScheduledAt != null`; add overview KPI + `erasurePending` usage filter; extend Status column badge.

**Spec:** `docs/superpowers/specs/2026-07-14-platform-pending-erasure-visibility-design.md`

---

### Task 1: Backend — tenant query + overview KPI

**Files:**
- Modify: `server/src/lib/platformMetrics.ts`
- Modify: `server/src/routes/platform.ts` (add `erasurePending` to allowed usageFilters)

- [ ] **Step 1:** Add `erasurePending` to `PlatformTenantUsageFilter` type and `matchesTenantUsageFilter` (match when `erasureScheduledAt != null`).

- [ ] **Step 2:** Change `fetchPlatformTenants` base `where`:
  - Default: `OR: [{ deletedAt: null }, { erasureScheduledAt: { not: null } }]`
  - `usageFilter === "erasurePending"`: `{ erasureScheduledAt: { not: null } }`
  - Select `erasureScheduledAt` on user; map to ISO string on row type `PlatformTenantRow`.

- [ ] **Step 3:** Add `pendingErasure` count to `fetchPlatformOverview` return type and query.

- [ ] **Step 4:** Allow `usageFilter=erasurePending` in `platform.ts` route allowlist.

- [ ] **Step 5:** Run `npx tsc --noEmit -p server/tsconfig.json` (platformMetrics/platform routes).

---

### Task 2: Frontend types + API client

**Files:**
- Modify: `src/lib/platformApi.ts`

- [ ] **Step 1:** Add `erasureScheduledAt: string | null` to `PlatformTenant`.
- [ ] **Step 2:** Add `pendingErasure: number` to `PlatformOverview`.
- [ ] **Step 3:** Add `erasurePending` to `PlatformTenantUsageFilter` and `USAGE_FILTER_LABELS` (e.g. “Pending deletion”).

---

### Task 3: Platform Overview UI

**Files:**
- Modify: `src/app/platform/page.tsx`

- [ ] **Step 1:** Add KPI / `UsageFilterCard` for `pendingErasure` → toggles `erasurePending` filter.

- [ ] **Step 2:** Update Status column logic:

```tsx
{t.erasureScheduledAt ? (
  <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950/40 dark:text-red-300">
    Deletion scheduled · {formatDate(t.erasureScheduledAt)}
  </span>
) : t.onboardingComplete ? (
  <span className="text-xs text-green-700 dark:text-green-400">Active</span>
) : (
  <span className="text-xs text-amber-700 dark:text-amber-400">Setup pending</span>
)}
```

- [ ] **Step 3:** Optional row class when `t.erasureScheduledAt`: subtle amber background.

- [ ] **Step 4:** Fix table `colSpan` if column count changed (still 9 columns).

- [ ] **Step 5:** Manual test — schedule erasure, confirm row + badge + filter + Manage + cancel on detail.

---

### Task 4: Docs

**Files:**
- Modify: `docs/legal/audit-log.md` (one line: pending erasure visible on `/platform`)
- Modify: `docs/technical-dept.md` (changelog)

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-07-14-platform-pending-erasure-visibility.md`.

Ready to implement inline or subagent-driven on your go.
