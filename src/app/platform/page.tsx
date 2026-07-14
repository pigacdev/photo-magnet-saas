"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchPlatformOverview,
  fetchPlatformTenants,
  USAGE_FILTER_LABELS,
  type PlatformNotificationSelection,
  type PlatformNotificationSendResult,
  type PlatformOverview,
  type PlatformTenant,
  type PlatformTenantUsageFilter,
  type TenantOrder,
  type TenantSort,
} from "@/lib/platformApi";
import { PlatformBulkEmailModal } from "@/components/platform/PlatformBulkEmailModal";
import { getDisplayPreferences } from "@/lib/auth";
import { formatDisplayMonthDay } from "@/lib/dateFormat";
import {
  entitlementsForPlan,
  hasUnlimitedEvents,
  hasUnlimitedOrders,
  planDisplayName,
} from "@/lib/planCatalog";
import { useChartTheme } from "@/hooks/useChartTheme";

function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function KpiCard({
  label,
  value,
  delta,
  subtitle,
}: {
  label: string;
  value: string;
  delta?: ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {delta}
      {subtitle ? (
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}

function DeltaGmv({
  thisMonth,
  lastMonth,
  formatMoney,
}: {
  thisMonth: number;
  lastMonth: number;
  formatMoney: (n: number) => string;
}) {
  const d = thisMonth - lastMonth;
  if (d === 0) {
    return (
      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
        Same as last month
      </p>
    );
  }
  const up = d > 0;
  return (
    <p
      className={`mt-1 text-xs font-medium tabular-nums ${
        up ? "text-green-600" : "text-orange-600"
      }`}
    >
      {up ? "+" : ""}
      {formatMoney(d)} vs last month
    </p>
  );
}

function PlanChip({ plan, count }: { plan: "FREE" | "HOBBY" | "PRO"; count: number }) {
  const colors =
    plan === "PRO"
      ? "bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
      : plan === "HOBBY"
        ? "bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300"
        : "bg-surface text-muted-foreground";
  return (
    <div
      className={`rounded-lg border border-border px-4 py-3 ${colors}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">
        {planDisplayName(plan)}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{count}</p>
    </div>
  );
}

function formatOrderUsage(used: number, plan: PlatformTenant["plan"]): string {
  const limit = entitlementsForPlan(plan).orderLimit;
  if (hasUnlimitedOrders(limit)) return `${used} / ∞`;
  return `${used} / ${limit}`;
}

function formatEventUsage(used: number, plan: PlatformTenant["plan"]): string {
  const limit = entitlementsForPlan(plan).eventLimit;
  if (hasUnlimitedEvents(limit)) return `${used} / ∞`;
  return `${used} / ${limit}`;
}

function SignupsChart({
  last30Days,
  byMonth,
  byYear,
}: {
  last30Days: PlatformOverview["signupsLast30Days"];
  byMonth: PlatformOverview["signupsByMonth"];
  byYear: PlatformOverview["signupsByYear"];
}) {
  const chartTheme = useChartTheme();
  const dateFormat = getDisplayPreferences().dateFormat;
  const chartHeight = 240;
  const [mounted, setMounted] = useState(false);
  const [trendMode, setTrendMode] = useState<"days" | "month" | "year">("days");

  useEffect(() => {
    setMounted(true);
  }, []);

  const chartData =
    trendMode === "days"
      ? last30Days
      : trendMode === "month"
        ? byMonth
        : byYear;
  const xDataKey = trendMode === "days" ? "date" : trendMode === "month" ? "label" : "year";
  const title =
    trendMode === "days"
      ? "Last 30 days"
      : trendMode === "month"
        ? "By month"
        : "By year";
  const subtitle =
    trendMode === "days"
      ? "Daily seller signups"
      : trendMode === "month"
        ? "Seller signups by month (this year)"
        : "Seller signups by year";

  function formatX(value: string): string {
    if (trendMode === "days") {
      return formatDisplayMonthDay(ymdToLocalDate(value), dateFormat);
    }
    return value;
  }

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTrendMode("days")}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
            trendMode === "days"
              ? "border-primary bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
              : "border-border bg-background text-muted-foreground hover:bg-surface"
          }`}
        >
          Last 30 days
        </button>
        <button
          type="button"
          onClick={() => setTrendMode("month")}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
            trendMode === "month"
              ? "border-primary bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
              : "border-border bg-background text-muted-foreground hover:bg-surface"
          }`}
        >
          By month
        </button>
        <button
          type="button"
          onClick={() => setTrendMode("year")}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
            trendMode === "year"
              ? "border-primary bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
              : "border-border bg-background text-muted-foreground hover:bg-surface"
          }`}
        >
          By year
        </button>
      </div>
      <h2 className="mt-4 text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      <div className="mt-4 h-[240px] w-full min-h-[240px] min-w-0 max-w-full">
        {mounted ? (
          <div className="h-full w-full min-w-0">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              minHeight={chartHeight}
              initialDimension={{ width: 400, height: chartHeight }}
              debounce={50}
            >
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis
                  dataKey={xDataKey}
                  tick={{ fontSize: 10, fill: chartTheme.tick }}
                  tickFormatter={(v) => formatX(String(v))}
                  interval={trendMode === "days" ? "preserveStartEnd" : 0}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: chartTheme.tick }}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: `1px solid ${chartTheme.tooltipBorder}`,
                    backgroundColor: chartTheme.tooltipBg,
                    color: chartTheme.tooltipText,
                    fontSize: "12px",
                  }}
                  labelFormatter={(label) => formatX(String(label))}
                />
                <Line
                  type="monotone"
                  dataKey="signups"
                  name="Signups"
                  stroke="#2563EB"
                  strokeWidth={2}
                  dot={trendMode !== "days"}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const SORT_OPTIONS: { value: TenantSort; label: string }[] = [
  { value: "createdAt", label: "Signup date" },
  { value: "ordersThisMonth", label: "Orders this month" },
  { value: "settledRevenue", label: "Lifetime revenue" },
];

function AlertFilterCard({
  title,
  count,
  subtitle,
  variant,
  active,
  onClick,
}: {
  title: string;
  count: number;
  subtitle?: string;
  variant: "orange" | "red" | "amber";
  active: boolean;
  onClick: () => void;
}) {
  const variantClasses = {
    orange:
      "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300",
    red: "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300",
    amber:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
  }[variant];
  const valueClasses = {
    orange: "text-orange-900 dark:text-orange-200",
    red: "text-red-900 dark:text-red-200",
    amber: "text-amber-900 dark:text-amber-200",
  }[variant];
  const subtitleClasses = {
    orange: "text-orange-800/80 dark:text-orange-300/80",
    red: "text-red-800/80 dark:text-red-300/80",
    amber: "text-amber-800/80 dark:text-amber-300/80",
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`cursor-pointer rounded-lg border px-4 py-3 text-left transition-all hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:brightness-110 ${variantClasses} ${
        active ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide">{title}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${valueClasses}`}>
        {count}
      </p>
      {subtitle ? (
        <p className={`mt-1 text-xs ${subtitleClasses}`}>{subtitle}</p>
      ) : null}
      <p className="mt-2 text-[10px] font-medium uppercase tracking-wide opacity-70">
        {active ? "Showing in table · click to clear" : "Click to filter sellers"}
      </p>
    </button>
  );
}

export default function PlatformPage() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [tenantTotal, setTenantTotal] = useState(0);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sort, setSort] = useState<TenantSort>("createdAt");
  const [order, setOrder] = useState<TenantOrder>("desc");
  const [usageFilter, setUsageFilter] = useState<PlatformTenantUsageFilter | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [excludeIds, setExcludeIds] = useState<Set<string>>(() => new Set());
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [sendResult, setSendResult] = useState<PlatformNotificationSendResult | null>(
    null,
  );
  const pageSize = 25;

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectAllMatching(false);
    setExcludeIds(new Set());
  }, []);

  const toggleUsageFilter = useCallback((filter: PlatformTenantUsageFilter) => {
    setPage(1);
    setUsageFilter((prev) => (prev === filter ? null : filter));
    document.getElementById("platform-sellers-table")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const loadOverview = useCallback(() => {
    setOverviewLoading(true);
    setOverviewError(null);
    void fetchPlatformOverview()
      .then(setOverview)
      .catch((err: unknown) => {
        setOverview(null);
        setOverviewError(
          err instanceof Error ? err.message : "Failed to load platform metrics.",
        );
      })
      .finally(() => setOverviewLoading(false));
  }, []);

  const loadTenants = useCallback(() => {
    setTenantLoading(true);
    setTenantError(null);
    void fetchPlatformTenants({ page, pageSize, search, sort, order, usageFilter })
      .then((res) => {
        setTenants(res.tenants);
        setTenantTotal(res.total);
      })
      .catch((err: unknown) => {
        setTenants([]);
        setTenantTotal(0);
        setTenantError(
          err instanceof Error ? err.message : "Failed to load sellers.",
        );
      })
      .finally(() => setTenantLoading(false));
  }, [page, search, sort, order, usageFilter]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  useEffect(() => {
    clearSelection();
  }, [search, usageFilter, sort, order, clearSelection]);

  function isRowSelected(id: string): boolean {
    if (selectAllMatching) return !excludeIds.has(id);
    return selectedIds.has(id);
  }

  function toggleRow(id: string) {
    if (selectAllMatching) {
      setExcludeIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pageAllSelected =
    tenants.length > 0 && tenants.every((t) => isRowSelected(t.id));

  function togglePageSelection() {
    if (pageAllSelected) {
      if (selectAllMatching) {
        setExcludeIds((prev) => {
          const next = new Set(prev);
          for (const t of tenants) next.add(t.id);
          return next;
        });
      } else {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const t of tenants) next.delete(t.id);
          return next;
        });
      }
      return;
    }
    if (selectAllMatching) {
      setExcludeIds((prev) => {
        const next = new Set(prev);
        for (const t of tenants) next.delete(t.id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const t of tenants) next.add(t.id);
        return next;
      });
    }
  }

  function activateSelectAllMatching() {
    setSelectAllMatching(true);
    setSelectedIds(new Set());
    setExcludeIds(new Set());
  }

  const selectionCount = selectAllMatching
    ? tenantTotal - excludeIds.size
    : selectedIds.size;

  const canSelectAllMatching =
    !selectAllMatching && tenantTotal > 0 && selectionCount < tenantTotal;

  function buildSelection(): PlatformNotificationSelection {
    if (selectAllMatching) {
      return {
        mode: "all_matching",
        filters: {
          search: search || undefined,
          usageFilter: usageFilter ?? undefined,
          sort,
          order,
        },
        excludeUserIds: excludeIds.size > 0 ? [...excludeIds] : undefined,
      };
    }
    return { mode: "explicit", userIds: [...selectedIds] };
  }

  function handleEmailSent(result: PlatformNotificationSendResult) {
    setSendResult(result);
    clearSelection();
  }

  function formatMoney(n: number) {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
    }).format(n);
  }

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    }).format(new Date(iso));
  }

  const totalPages = Math.max(1, Math.ceil(tenantTotal / pageSize));

  return (
    <div className="dashboard-page space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Platform overview
        </h1>
        <p className="mt-2 text-muted-foreground">
          Cross-tenant metrics for Magnetoo sellers. GMV is buyer order revenue, not
          subscription MRR.
        </p>
      </div>

      {overviewError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {overviewError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total sellers"
          value={overviewLoading ? "…" : String(overview?.totalSellers ?? "—")}
        />
        <KpiCard
          label="GMV this month"
          value={
            overviewLoading
              ? "…"
              : overview != null
                ? formatMoney(overview.gmvThisMonth)
                : "—"
          }
          delta={
            overview != null && !overviewLoading ? (
              <DeltaGmv
                thisMonth={overview.gmvThisMonth}
                lastMonth={overview.gmvLastMonth}
                formatMoney={formatMoney}
              />
            ) : undefined
          }
        />
        <KpiCard
          label="Orders this month"
          value={overviewLoading ? "…" : String(overview?.ordersThisMonth ?? "—")}
          subtitle="All sellers"
        />
        <KpiCard
          label="Active sellers (30d)"
          value={
            overviewLoading ? "…" : String(overview?.activeSellersLast30Days ?? "—")
          }
          subtitle="At least one order"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <PlanChip plan="FREE" count={overview?.planBreakdown.FREE ?? 0} />
        <PlanChip plan="HOBBY" count={overview?.planBreakdown.HOBBY ?? 0} />
        <PlanChip plan="PRO" count={overview?.planBreakdown.PRO ?? 0} />
      </div>

      {!overviewLoading && overview != null ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <AlertFilterCard
            title="Pending deletion"
            count={overview.pendingErasure ?? 0}
            subtitle="Grace period before purge"
            variant="red"
            active={usageFilter === "erasurePending"}
            onClick={() => toggleUsageFilter("erasurePending")}
          />
          <AlertFilterCard
            title="Near order limit"
            count={overview.nearOrderLimit}
            subtitle="80–99% of plan quota"
            variant="orange"
            active={usageFilter === "nearOrderLimit"}
            onClick={() => toggleUsageFilter("nearOrderLimit")}
          />
          <AlertFilterCard
            title="Near event limit"
            count={overview.nearEventLimit}
            subtitle="80–99% of plan quota"
            variant="orange"
            active={usageFilter === "nearEventLimit"}
            onClick={() => toggleUsageFilter("nearEventLimit")}
          />
          <AlertFilterCard
            title="Order limit reached"
            count={overview.orderLimitReached ?? 0}
            subtitle="At or over monthly order cap"
            variant="red"
            active={usageFilter === "orderLimitReached"}
            onClick={() => toggleUsageFilter("orderLimitReached")}
          />
          <AlertFilterCard
            title="Event limit reached"
            count={overview.eventLimitReached ?? 0}
            subtitle="At or over monthly event cap"
            variant="red"
            active={usageFilter === "eventLimitReached"}
            onClick={() => toggleUsageFilter("eventLimitReached")}
          />
          <AlertFilterCard
            title="Onboarding incomplete"
            count={overview.onboardingIncomplete}
            variant="amber"
            active={usageFilter === "onboardingIncomplete"}
            onClick={() => toggleUsageFilter("onboardingIncomplete")}
          />
        </div>
      ) : null}

      {overview?.signupsLast30Days ? (
        <SignupsChart
          last30Days={overview.signupsLast30Days}
          byMonth={overview.signupsByMonth ?? []}
          byYear={overview.signupsByYear ?? []}
        />
      ) : null}

      <div
        id="platform-sellers-table"
        className="rounded-lg border border-border bg-card shadow-sm"
      >
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Sellers</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {tenantLoading
                ? "Loading…"
                : tenantError
                  ? tenantError
                  : usageFilter
                    ? `${tenantTotal} matching “${USAGE_FILTER_LABELS[usageFilter]}”`
                    : `${tenantTotal} total`}
            </p>
            {usageFilter ? (
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setUsageFilter(null);
                }}
                className="mt-3 cursor-pointer rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-surface"
              >
                Clear filter
              </button>
            ) : null}
          </div>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setSearch(searchInput);
            }}
          >
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Search
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Email or business name"
                className="w-full min-w-[200px] rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Sort
              <select
                value={sort}
                onChange={(e) => {
                  setPage(1);
                  setSort(e.target.value as TenantSort);
                }}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Order
              <select
                value={order}
                onChange={(e) => {
                  setPage(1);
                  setOrder(e.target.value as TenantOrder);
                }}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </label>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Apply
            </button>
          </form>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-blue-50/80 px-4 py-3 dark:bg-blue-950/20">
          <p className="text-sm font-medium text-foreground tabular-nums">
            {selectAllMatching
              ? `All ${selectionCount} matching seller${selectionCount === 1 ? "" : "s"} selected`
              : `${selectionCount} seller${selectionCount === 1 ? "" : "s"} selected`}
          </p>
          <div className="flex flex-wrap gap-2">
            {canSelectAllMatching ? (
              <button
                type="button"
                onClick={activateSelectAllMatching}
                disabled={tenantLoading || tenantTotal === 0}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface disabled:opacity-50"
              >
                Select all ({tenantTotal})
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setEmailModalOpen(true)}
              disabled={selectionCount === 0}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Email selected
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={selectionCount === 0}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>

        {sendResult ? (
          <div
            className={`border-b px-4 py-3 text-sm ${
              sendResult.failed > 0
                ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
                : "border-green-200 bg-green-50 text-green-900 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-200"
            }`}
          >
            Sent to {sendResult.sent} seller{sendResult.sent === 1 ? "" : "s"}
            {sendResult.skippedOptOut > 0
              ? ` (${sendResult.skippedOptOut} skipped due to marketing opt-out)`
              : ""}
            {sendResult.failed > 0 ? ` · ${sendResult.failed} failed` : ""}.
            <button
              type="button"
              onClick={() => setSendResult(null)}
              className="ml-3 font-medium underline"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface/50 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="w-10 px-4 py-3 font-medium">
                  <input
                    type="checkbox"
                    checked={pageAllSelected}
                    ref={(el) => {
                      if (el) {
                        el.indeterminate =
                          !pageAllSelected &&
                          tenants.some((t) => isRowSelected(t.id));
                      }
                    }}
                    onChange={togglePageSelection}
                    disabled={tenantLoading || tenants.length === 0}
                    aria-label="Select all sellers on this page"
                    className="size-4 rounded border-border"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Seller</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Signed up</th>
                <th className="px-4 py-3 font-medium">Orders / mo</th>
                <th className="px-4 py-3 font-medium">Events / mo</th>
                <th className="px-4 py-3 font-medium">Lifetime GMV</th>
                <th className="px-4 py-3 font-medium">Last order</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenantLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                    Loading sellers…
                  </td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                    {usageFilter
                      ? "No sellers match this filter."
                      : "No sellers found."}
                  </td>
                </tr>
              ) : (
                tenants.map((t) => (
                  <tr
                    key={t.id}
                    className={`border-b border-border last:border-0 hover:bg-surface/40 ${
                      t.erasureScheduledAt
                        ? "bg-amber-50/40 dark:bg-amber-950/15"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isRowSelected(t.id)}
                        onChange={() => toggleRow(t.id)}
                        aria-label={`Select ${t.email}`}
                        className="size-4 rounded border-border"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{t.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.businessName || t.name || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">{planDisplayName(t.plan)}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {formatDate(t.createdAt)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatOrderUsage(t.ordersThisMonth, t.plan)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatEventUsage(t.eventsThisMonth, t.plan)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatMoney(t.settledRevenue)}
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({t.totalSettledOrders})
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {formatDate(t.lastOrderAt)}
                    </td>
                    <td className="px-4 py-3">
                      {t.erasureScheduledAt ? (
                        <span className="inline-flex max-w-[11rem] flex-col rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium leading-snug text-red-800 dark:bg-red-950/40 dark:text-red-300">
                          <span>Deletion scheduled</span>
                          <span className="font-normal opacity-90">
                            {formatDate(t.erasureScheduledAt)}
                          </span>
                        </span>
                      ) : t.onboardingComplete ? (
                        <span className="text-xs text-green-700 dark:text-green-400">
                          Active
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700 dark:text-amber-400">
                          Setup pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/platform/tenants/${t.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {tenantTotal > pageSize ? (
          <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || tenantLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages || tenantLoading}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <PlatformBulkEmailModal
        open={emailModalOpen}
        recipientCount={selectionCount}
        selection={buildSelection()}
        onClose={() => setEmailModalOpen(false)}
        onSent={handleEmailSent}
      />
    </div>
  );
}
