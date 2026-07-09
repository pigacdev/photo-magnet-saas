"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/lib/api";
import {
  getCachedOrganizationUsage,
  getDisplayPreferences,
  subscribeOrganizationUsage,
} from "@/lib/auth";
import { formatDisplayMonthDay } from "@/lib/dateFormat";
import { PlanUsageAlertBanner } from "@/components/dashboard/PlanUsageAlertBanner";
import { storefrontNavHref } from "@/components/dashboard/dashboardNav";
import { useSellerStorefront } from "@/hooks/useSellerStorefront";
import { useChartTheme } from "@/hooks/useChartTheme";
import { usageHasFeature } from "@/lib/planFeatures";

type Last7DayPoint = {
  date: string;
  orders: number;
  revenue: number;
};

type ByMonthPoint = {
  month: string;
  label: string;
  orders: number;
  revenue: number;
};

type DashboardStats = {
  scope?: "basic" | "advanced";
  currency: string;
  ordersThisMonth: number;
  revenueThisMonth: number;
  ordersLastMonth?: number;
  revenueLastMonth?: number;
  averageOrderValueThisMonth?: number;
  averageOrderValueLastMonth?: number;
  magnetsSoldThisMonth?: number;
  magnetsSoldLastMonth?: number;
  newOrders?: number;
  unpaidOrders?: number;
  ordersNeedingPrint?: number;
  last7Days: Last7DayPoint[];
  byMonth?: ByMonthPoint[];
};

function DeltaVsLastMonthOrders({
  thisMonth,
  lastMonth,
}: {
  thisMonth: number;
  lastMonth: number;
}) {
  const d = thisMonth - lastMonth;
  if (d === 0) {
    return (
      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
        0 vs last month
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
      {up ? `↑ +${d}` : `↓ ${d}`} vs last month
    </p>
  );
}

function DeltaVsLastMonthRevenue({
  thisMonth,
  lastMonth,
  formatMoney,
}: {
  thisMonth: number;
  lastMonth: number;
  formatMoney: (n: number) => string;
}) {
  const d = Math.round((thisMonth - lastMonth) * 100) / 100;
  if (Math.abs(d) < 0.005) {
    return (
      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
        0 vs last month
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
      {up
        ? `↑ +${formatMoney(Math.abs(d))}`
        : `↓ ${formatMoney(d)}`}{" "}
      vs last month
    </p>
  );
}

function DeltaVsLastMonthCount({
  thisMonth,
  lastMonth,
}: {
  thisMonth: number;
  lastMonth: number;
}) {
  const d = thisMonth - lastMonth;
  if (d === 0) {
    return (
      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
        0 vs last month
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
      {up ? `↑ +${d}` : `↓ ${d}`} vs last month
    </p>
  );
}

function KpiCard({
  label,
  value,
  subtitle,
  delta,
  href,
}: {
  label: string;
  value: string;
  subtitle?: string;
  delta?: ReactNode;
  href?: string;
}) {
  const inner = (
    <>
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
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-border hover:bg-surface"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      {inner}
    </div>
  );
}

function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function DashboardTrendsChart({
  trendMode,
  onTrendModeChange,
  last7Days,
  byMonth,
  currency,
  showMonthToggle = true,
}: {
  trendMode: "days" | "months";
  onTrendModeChange: (mode: "days" | "months") => void;
  last7Days: Last7DayPoint[];
  byMonth: ByMonthPoint[];
  currency: string;
  showMonthToggle?: boolean;
}) {
  const chartTheme = useChartTheme();
  const dateFormat = getDisplayPreferences().dateFormat;
  const data: Array<Last7DayPoint | ByMonthPoint> =
    trendMode === "days" ? last7Days : byMonth;
  const xDataKey = trendMode === "days" ? "date" : "label";
  const formatX = (v: string) =>
    trendMode === "days"
      ? formatDisplayMonthDay(ymdToLocalDate(String(v)), dateFormat)
      : String(v);
  const title =
    trendMode === "days" ? "Last 7 days" : "By month";
  const subtitle =
    trendMode === "days"
      ? "Orders and revenue by day"
      : "Orders and revenue by month (this year)";

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm">
      {showMonthToggle ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onTrendModeChange("days")}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              trendMode === "days"
                ? "border-primary bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                : "border-border bg-background text-muted-foreground hover:bg-surface"
            }`}
          >
            Last 7 days
          </button>
          <button
            type="button"
            onClick={() => onTrendModeChange("months")}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              trendMode === "months"
                ? "border-primary bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                : "border-border bg-background text-muted-foreground hover:bg-surface"
            }`}
          >
            By month
          </button>
        </div>
      ) : null}
      <h2 className="mt-4 text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      <div className="mt-4 h-[280px] w-full min-h-[280px] min-w-0 max-w-full">
        <div className="h-full w-full min-w-0" style={{ width: "100%", minHeight: 280 }}>
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={280}
            initialDimension={{ width: 400, height: 280 }}
            debounce={50}
          >
            <LineChart<Last7DayPoint | ByMonthPoint>
              data={data}
              margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis
                dataKey={xDataKey}
                tick={{ fontSize: 11, fill: chartTheme.tick }}
                tickFormatter={(v) => formatX(String(v))}
                interval={0}
              />
              <YAxis
                yAxisId="orders"
                allowDecimals={false}
                tick={{ fontSize: 11, fill: chartTheme.tick }}
                width={36}
              />
              <YAxis
                yAxisId="revenue"
                orientation="right"
                tick={{ fontSize: 11, fill: chartTheme.tick }}
                width={44}
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
                formatter={(value, name) => {
                  if (name === "revenue" || name === "Revenue") {
                    return [
                      new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: currency || "EUR",
                      }).format(Number(value)),
                      "Revenue",
                    ];
                  }
                  return [value, "Orders"];
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line
                yAxisId="orders"
                type="monotone"
                dataKey="orders"
                name="Orders"
                stroke="#2563EB"
                strokeWidth={2}
                dot={{ r: 3, fill: "#2563EB" }}
                activeDot={{ r: 5 }}
              />
              <Line
                yAxisId="revenue"
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="#16A34A"
                strokeWidth={2}
                dot={{ r: 3, fill: "#16A34A" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { storefront } = useSellerStorefront();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [trendMode, setTrendMode] = useState<"days" | "months">("days");
  const [usage, setUsage] = useState(() => getCachedOrganizationUsage());
  const orgCurrency = usage?.currency ?? stats?.currency ?? null;

  useEffect(() => {
    return subscribeOrganizationUsage(() => {
      setUsage(getCachedOrganizationUsage());
    });
  }, []);

  const advancedAnalytics = usageHasFeature(usage, "analytics_advanced");

  useEffect(() => {
    setStatsLoading(true);
    void api<DashboardStats>("/api/dashboard/stats")
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, [orgCurrency]);

  const displayCurrency = orgCurrency ?? "EUR";

  function formatKpiMoney(n: number) {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: displayCurrency,
    }).format(n);
  }

  return (
    <div className="dashboard-page">
      <div>
        <PlanUsageAlertBanner />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="mt-2 text-muted-foreground">
          Manage your events and orders.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="Orders this month"
            value={statsLoading ? "…" : String(stats?.ordersThisMonth ?? "—")}
            delta={
              advancedAnalytics &&
              stats != null &&
              !statsLoading &&
              stats.ordersLastMonth != null ? (
                <DeltaVsLastMonthOrders
                  thisMonth={stats.ordersThisMonth}
                  lastMonth={stats.ordersLastMonth}
                />
              ) : undefined
            }
          />
          <KpiCard
            label="Revenue this month"
            value={
              statsLoading
                ? "…"
                : stats != null
                  ? formatKpiMoney(stats.revenueThisMonth)
                  : "—"
            }
            delta={
              advancedAnalytics &&
              stats != null &&
              !statsLoading &&
              stats.revenueLastMonth != null ? (
                <DeltaVsLastMonthRevenue
                  thisMonth={stats.revenueThisMonth}
                  lastMonth={stats.revenueLastMonth}
                  formatMoney={formatKpiMoney}
                />
              ) : undefined
            }
          />
          {advancedAnalytics ? (
            <>
              <KpiCard
                label="Average order value"
                value={
                  statsLoading
                    ? "…"
                    : stats != null && stats.averageOrderValueThisMonth != null
                      ? formatKpiMoney(stats.averageOrderValueThisMonth)
                      : "—"
                }
                subtitle="Paid orders this month"
                delta={
                  stats != null &&
                  !statsLoading &&
                  stats.averageOrderValueLastMonth != null &&
                  stats.averageOrderValueThisMonth != null ? (
                    <DeltaVsLastMonthRevenue
                      thisMonth={stats.averageOrderValueThisMonth}
                      lastMonth={stats.averageOrderValueLastMonth}
                      formatMoney={formatKpiMoney}
                    />
                  ) : undefined
                }
              />
              <KpiCard
                label="Magnets sold"
                value={
                  statsLoading
                    ? "…"
                    : String(stats?.magnetsSoldThisMonth ?? "—")
                }
                subtitle="This month"
                delta={
                  stats != null &&
                  !statsLoading &&
                  stats.magnetsSoldLastMonth != null &&
                  stats.magnetsSoldThisMonth != null ? (
                    <DeltaVsLastMonthCount
                      thisMonth={stats.magnetsSoldThisMonth}
                      lastMonth={stats.magnetsSoldLastMonth}
                    />
                  ) : undefined
                }
              />
              <KpiCard
                label="New orders"
                value={statsLoading ? "…" : String(stats?.newOrders ?? "—")}
                subtitle="Needs first review"
                href="/dashboard/orders?status=new"
              />
              <KpiCard
                label="Unpaid orders"
                value={statsLoading ? "…" : String(stats?.unpaidOrders ?? "—")}
                subtitle="Awaiting payment"
                href="/dashboard/orders?status=unpaid"
              />
              <KpiCard
                label="Needs printing"
                value={
                  statsLoading ? "…" : String(stats?.ordersNeedingPrint ?? "—")
                }
                subtitle="Unprinted images"
                href="/dashboard/orders?printStatus=needs_printing"
              />
            </>
          ) : null}
        </div>

        {!advancedAnalytics && !statsLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Upgrade to Hobby for advanced analytics (trends, AOV, and more).{" "}
            <Link href="/dashboard/billing" className="text-primary hover:underline">
              View plans
            </Link>
          </p>
        ) : null}

        {!statsLoading && stats && stats.last7Days.length > 0 ? (
          <div className="mt-8 min-w-0 w-full">
            <DashboardTrendsChart
              trendMode={advancedAnalytics ? trendMode : "days"}
              onTrendModeChange={
                advancedAnalytics ? setTrendMode : () => undefined
              }
              last7Days={stats.last7Days}
              byMonth={stats.byMonth ?? []}
              currency={displayCurrency}
              showMonthToggle={advancedAnalytics}
            />
          </div>
        ) : null}

      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/dashboard/orders"
          className="rounded-lg border border-border p-6 transition-colors hover:border-border hover:bg-surface"
        >
          <h2 className="text-base font-medium text-foreground">Orders</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            View orders and download print sheets.
          </p>
        </Link>
        <Link
          href="/dashboard/events"
          className="rounded-lg border border-border p-6 transition-colors hover:border-border hover:bg-surface"
        >
          <h2 className="text-base font-medium text-foreground">Events</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and manage your events.
          </p>
        </Link>
        <Link
          href={storefrontNavHref(storefront?.id ?? null)}
          className="rounded-lg border border-border p-6 transition-colors hover:border-border hover:bg-surface"
        >
          <h2 className="text-base font-medium text-foreground">Storefront</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your always-on ordering link.
          </p>
        </Link>
      </div>
    </div>
  );
}
