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
import { PlanUsageAlertBanner } from "@/components/dashboard/PlanUsageAlertBanner";
import { storefrontNavHref } from "@/components/dashboard/dashboardNav";
import { useSellerStorefront } from "@/hooks/useSellerStorefront";

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
  ordersThisMonth: number;
  revenueThisMonth: number;
  ordersLastMonth: number;
  revenueLastMonth: number;
  averageOrderValueThisMonth: number;
  averageOrderValueLastMonth: number;
  magnetsSoldThisMonth: number;
  magnetsSoldLastMonth: number;
  newOrders: number;
  unpaidOrders: number;
  last7Days: Last7DayPoint[];
  byMonth: ByMonthPoint[];
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
      <p className="mt-1 text-xs tabular-nums text-gray-500">
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
      <p className="mt-1 text-xs tabular-nums text-gray-500">
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
      <p className="mt-1 text-xs tabular-nums text-gray-500">
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
      <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-[#111111]">
        {value}
      </p>
      {delta}
      {subtitle ? (
        <p className="mt-1 text-xs text-[#9CA3AF]">{subtitle}</p>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-gray-300 hover:bg-[#F9FAFB]"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {inner}
    </div>
  );
}

function formatAxisDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function DashboardTrendsChart({
  trendMode,
  onTrendModeChange,
  last7Days,
  byMonth,
}: {
  trendMode: "days" | "months";
  onTrendModeChange: (mode: "days" | "months") => void;
  last7Days: Last7DayPoint[];
  byMonth: ByMonthPoint[];
}) {
  const data: Array<Last7DayPoint | ByMonthPoint> =
    trendMode === "days" ? last7Days : byMonth;
  const xDataKey = trendMode === "days" ? "date" : "label";
  const formatX = (v: string) =>
    trendMode === "days" ? formatAxisDate(String(v)) : String(v);
  const title =
    trendMode === "days" ? "Last 7 days" : "By month";
  const subtitle =
    trendMode === "days"
      ? "Orders and revenue by day"
      : "Orders and revenue by month (this year)";

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onTrendModeChange("days")}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
            trendMode === "days"
              ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]"
              : "border-gray-200 bg-white text-[#374151] hover:bg-gray-50"
          }`}
        >
          Last 7 days
        </button>
        <button
          type="button"
          onClick={() => onTrendModeChange("months")}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
            trendMode === "months"
              ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]"
              : "border-gray-200 bg-white text-[#374151] hover:bg-gray-50"
          }`}
        >
          By month
        </button>
      </div>
      <h2 className="mt-4 text-sm font-semibold text-[#111111]">{title}</h2>
      <p className="mt-1 text-xs text-[#6B7280]">{subtitle}</p>
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
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey={xDataKey}
                tick={{ fontSize: 11, fill: "#6B7280" }}
                tickFormatter={(v) => formatX(String(v))}
                interval={0}
              />
              <YAxis
                yAxisId="orders"
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#6B7280" }}
                width={36}
              />
              <YAxis
                yAxisId="revenue"
                orientation="right"
                tick={{ fontSize: 11, fill: "#6B7280" }}
                width={44}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #E5E7EB",
                  fontSize: "12px",
                }}
                labelFormatter={(label) => formatX(String(label))}
                formatter={(value, name) => {
                  if (name === "revenue" || name === "Revenue") {
                    return [
                      new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: "EUR",
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

  useEffect(() => {
    void api<DashboardStats>("/api/dashboard/stats")
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

  function formatKpiMoney(n: number) {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
    }).format(n);
  }

  return (
    <div className="dashboard-page">
      <div>
        <PlanUsageAlertBanner />
        <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
          Dashboard
        </h1>
        <p className="mt-2 text-[#6B7280]">
          Manage your events and orders.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="Orders this month"
            value={statsLoading ? "…" : String(stats?.ordersThisMonth ?? "—")}
            delta={
              stats != null && !statsLoading ? (
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
              stats != null && !statsLoading ? (
                <DeltaVsLastMonthRevenue
                  thisMonth={stats.revenueThisMonth}
                  lastMonth={stats.revenueLastMonth}
                  formatMoney={formatKpiMoney}
                />
              ) : undefined
            }
          />
          <KpiCard
            label="Average order value"
            value={
              statsLoading
                ? "…"
                : stats != null
                  ? formatKpiMoney(stats.averageOrderValueThisMonth)
                  : "—"
            }
            subtitle="Paid orders this month"
            delta={
              stats != null && !statsLoading ? (
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
              statsLoading ? "…" : String(stats?.magnetsSoldThisMonth ?? "—")
            }
            subtitle="This month"
            delta={
              stats != null && !statsLoading ? (
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
            href="/dashboard/orders?status=new"
          />
        </div>

        {!statsLoading &&
          stats &&
          stats.last7Days.length > 0 &&
          stats.byMonth.length > 0 && (
            <div className="mt-8 min-w-0 w-full">
              <DashboardTrendsChart
                trendMode={trendMode}
                onTrendModeChange={setTrendMode}
                last7Days={stats.last7Days}
                byMonth={stats.byMonth}
              />
            </div>
          )}

      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/dashboard/orders"
          className="rounded-lg border border-gray-200 p-6 transition-colors hover:border-gray-300 hover:bg-[#F9FAFB]"
        >
          <h2 className="text-base font-medium text-[#111111]">Orders</h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            View orders and download print sheets.
          </p>
        </Link>
        <Link
          href="/dashboard/events"
          className="rounded-lg border border-gray-200 p-6 transition-colors hover:border-gray-300 hover:bg-[#F9FAFB]"
        >
          <h2 className="text-base font-medium text-[#111111]">Events</h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            Create and manage your events.
          </p>
        </Link>
        <Link
          href={storefrontNavHref(storefront?.id ?? null)}
          className="rounded-lg border border-gray-200 p-6 transition-colors hover:border-gray-300 hover:bg-[#F9FAFB]"
        >
          <h2 className="text-base font-medium text-[#111111]">Storefront</h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            Manage your always-on ordering link.
          </p>
        </Link>
      </div>
    </div>
  );
}
