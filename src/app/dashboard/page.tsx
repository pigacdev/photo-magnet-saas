"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  getMe,
  getCachedOrganizationUsage,
  type OrganizationUsage,
} from "@/lib/auth";

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
  pendingPrints: number;
  waitingToShip: number;
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
    <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
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
      <div className="mt-4 h-[280px] w-full min-w-[280px]">
        <ResponsiveContainer width="100%" height="100%">
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
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [usage, setUsage] = useState<OrganizationUsage | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [trendMode, setTrendMode] = useState<"days" | "months">("days");

  useEffect(() => {
    void getMe().then(() => {
      setUsage(getCachedOrganizationUsage());
    });
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

  const percentage =
    usage != null &&
    usage.plan === "FREE" &&
    usage.orderLimit > 0
      ? Math.min(
          100,
          Math.round((usage.ordersThisMonth / usage.orderLimit) * 100),
        )
      : 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
          Dashboard
        </h1>
        <p className="mt-2 text-[#6B7280]">
          Manage your events and orders.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
              Orders this month
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-[#111111]">
              {statsLoading ? "…" : stats?.ordersThisMonth ?? "—"}
            </p>
            {stats != null && !statsLoading && (
              <DeltaVsLastMonthOrders
                thisMonth={stats.ordersThisMonth}
                lastMonth={stats.ordersLastMonth}
              />
            )}
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
              Revenue this month
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-[#111111]">
              {statsLoading
                ? "…"
                : stats != null
                  ? formatKpiMoney(stats.revenueThisMonth)
                  : "—"}
            </p>
            {stats != null && !statsLoading && (
              <DeltaVsLastMonthRevenue
                thisMonth={stats.revenueThisMonth}
                lastMonth={stats.revenueLastMonth}
                formatMoney={formatKpiMoney}
              />
            )}
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
              Pending prints
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-[#111111]">
              {statsLoading ? "…" : stats?.pendingPrints ?? "—"}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
              Waiting to ship
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-[#111111]">
              {statsLoading ? "…" : stats?.waitingToShip ?? "—"}
            </p>
          </div>
        </div>

        {!statsLoading &&
          stats &&
          stats.last7Days.length > 0 &&
          stats.byMonth.length > 0 && (
            <div className="mt-8">
              <DashboardTrendsChart
                trendMode={trendMode}
                onTrendModeChange={setTrendMode}
                last7Days={stats.last7Days}
                byMonth={stats.byMonth}
              />
            </div>
          )}

        {usage && (
          <div className="mt-4">
            <div className="text-sm text-muted-foreground">
              Current plan:{" "}
              <span className="font-medium text-foreground">{usage.plan}</span>
            </div>

            {usage.plan === "PRO" ? (
              <p className="mt-4 text-sm text-green-600">
                Unlimited orders on PRO plan
              </p>
            ) : (
              <>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Monthly usage</span>
                    <span>
                      {usage.ordersThisMonth} /{" "}
                      {usage.orderLimit === 0 ? "∞" : usage.orderLimit}
                    </span>
                  </div>

                  <div className="h-2 w-full rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-black transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>

                {percentage >= 80 && percentage < 100 && (
                  <p className="mt-2 text-sm text-orange-600">
                    You’re close to your monthly limit.
                  </p>
                )}

                {percentage >= 100 && (
                  <p className="mt-2 text-sm text-red-600">
                    You’ve reached your monthly limit. Upgrade to continue.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/billing")}
                  className="mt-2 text-sm underline"
                >
                  Upgrade to PRO
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>
    </div>
  );
}
