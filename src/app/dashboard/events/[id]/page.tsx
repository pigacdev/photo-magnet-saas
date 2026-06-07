"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bar,
  BarChart,
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
  getMe,
  subscribeOrganizationUsage,
} from "@/lib/auth";
import { usageHasFeature } from "@/lib/planFeatures";
import { DashboardCenteredNotice } from "@/components/dashboard/DashboardCenteredNotice";
import { EventConfigurationForm } from "@/components/dashboard/EventConfigurationForm";
import { confirmUnsavedChanges } from "@/hooks/useUnsavedChangesWarning";
import { chartTooltipStyle, useChartTheme } from "@/hooks/useChartTheme";

type AllowedShape = {
  id: string;
  shapeType: string;
  widthMm: number;
  heightMm: number;
  displayOrder: number;
};

type PricingRule = {
  id: string;
  type: "PER_ITEM" | "BUNDLE";
  price: string;
  currency: string;
  quantity: number | null;
  displayOrder: number | null;
};

type Event = {
  id: string;
  name: string;
  brandText: string | null;
  notificationEmail: string | null;
  sendOrderEmails: boolean;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isOpen: boolean;
  status: "upcoming" | "active" | "ended" | "inactive";
  configurationComplete?: boolean;
  maxMagnetsPerOrder: number | null;
  shapes: AllowedShape[];
  pricing: PricingRule[];
};

type EventAnalytics = {
  event: {
    eventId: string;
    eventName: string;
    startDate: string;
    endDate: string;
    startsAt: string;
    endsAt: string;
    isEnded: boolean;
    mediaDeletionAt: string;
    mediaDeletionCountdownSeconds: number | null;
  };
  metrics: {
    totalOrders: number;
    paidOrders: number;
    pendingPaymentOrders: number;
    totalRevenue: number;
    currency: string;
    averageOrderValue: number;
    uniqueCustomers: number;
    totalImages: number;
    totalCopies: number;
    averageImagesPerOrder: number;
    averageCopiesPerOrder: number;
  };
  salesByShape: Array<{
    shapeId: string;
    shapeName: string;
    orders: number;
    images: number;
    copies: number;
    revenue: number;
  }>;
  paymentBreakdown: Array<{
    key: string;
    label: string;
    orders: number;
    revenue: number;
  }>;
  ordersByDay: Array<{ date: string; orders: number; revenue: number }>;
};

const STATUS_BADGE: Record<Event["status"], { label: string; className: string }> = {
  upcoming: {
    label: "Upcoming",
    className: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  },
  active: {
    label: "Active",
    className: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  },
  ended: {
    label: "Ended",
    className: "bg-surface text-muted-foreground",
  },
  inactive: {
    label: "Inactive",
    className: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "EUR",
  }).format(amount);
}

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0 seconds";
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d} day${d === 1 ? "" : "s"}`);
  if (h > 0) parts.push(`${h} hour${h === 1 ? "" : "s"}`);
  if (m > 0) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  if (parts.length === 0 && s > 0) parts.push(`${s} second${s === 1 ? "" : "s"}`);
  if (parts.length === 0) parts.push("less than a second");
  return parts.join(", ");
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function EventAnalyticsPanel({ data }: { data: EventAnalytics }) {
  const { metrics, salesByShape, paymentBreakdown, ordersByDay } = data;
  const currency = metrics.currency || "EUR";
  const chartTheme = useChartTheme();
  const tick = { fontSize: 11, fill: chartTheme.tick };
  const tickSm = { fontSize: 10, fill: chartTheme.tick };
  const tooltipStyle = chartTooltipStyle(chartTheme);

  const ordersTimeData = useMemo(
    () =>
      ordersByDay.map((row) => ({
        ...row,
        dateLabel: row.date,
      })),
    [ordersByDay],
  );

  const shapeChartData = useMemo(
    () =>
      salesByShape.map((s) => ({
        name:
          s.shapeName.length > 28
            ? `${s.shapeName.slice(0, 26)}…`
            : s.shapeName,
        revenue: s.revenue,
        copies: s.copies,
      })),
    [salesByShape],
  );

  const paymentChartData = useMemo(
    () =>
      paymentBreakdown.map((p) => ({
        name: p.label,
        orders: p.orders,
        revenue: p.revenue,
      })),
    [paymentBreakdown],
  );

  return (
    <div className="space-y-6">
      <section className="dashboard-card">
        <h2 className="text-sm font-semibold text-foreground">Overview</h2>
        <p className="mt-1 text-xs text-muted-foreground">Key metrics for this event</p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Total orders"
            value={String(metrics.totalOrders)}
          />
          <KpiCard
            label="Paid orders"
            value={String(metrics.paidOrders)}
          />
          <KpiCard
            label="Revenue"
            value={formatMoney(metrics.totalRevenue, currency)}
          />
          <KpiCard
            label="Unique customers"
            value={String(metrics.uniqueCustomers)}
          />
          <KpiCard
            label="Total images"
            value={String(metrics.totalImages)}
          />
          <KpiCard
            label="Total magnets (copies)"
            value={String(metrics.totalCopies)}
          />
          <KpiCard
            label="Average order value"
            value={formatMoney(metrics.averageOrderValue, currency)}
            sub="Paid orders only"
          />
          <KpiCard
            label="Avg copies / order"
            value={metrics.averageCopiesPerOrder.toFixed(2)}
          />
        </div>
      </section>

      <section className="dashboard-card">
        <h2 className="text-sm font-semibold text-foreground">Orders over time</h2>
        <p className="mt-1 text-xs text-muted-foreground">Count and revenue by day (UTC)</p>
        <div className="mt-4 h-[280px] w-full min-h-[280px] min-w-0">
          <div className="h-full w-full min-w-0" style={{ minHeight: 280 }}>
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              minHeight={280}
              debounce={50}
            >
              <LineChart
                data={ordersTimeData}
                margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis
                  dataKey="dateLabel"
                  tick={tickSm}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="orders"
                  allowDecimals={false}
                  tick={tick}
                  width={32}
                />
                <YAxis
                  yAxisId="revenue"
                  orientation="right"
                  tick={tick}
                  width={48}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => {
                    if (name === "revenue" || name === "Revenue") {
                      return [formatMoney(Number(value), currency), "Revenue"];
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
                  dot={{ r: 2 }}
                />
                <Line
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#16A34A"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <section className="dashboard-card">
        <h2 className="text-sm font-semibold text-foreground">Sales by shape</h2>
        <p className="mt-1 text-xs text-muted-foreground">Revenue (paid orders, copy-weighted)</p>
        <div className="mt-4 h-[280px] w-full min-h-[280px] min-w-0">
          <div className="h-full w-full min-w-0" style={{ minHeight: 280 }}>
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              minHeight={280}
              debounce={50}
            >
              <BarChart
                data={shapeChartData}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis
                  type="number"
                  tick={tick}
                  tickFormatter={(v) => formatMoney(Number(v), currency)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={tickSm}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [formatMoney(Number(value), currency), "Revenue"]}
                />
                <Bar dataKey="revenue" name="Revenue" fill="#2563EB" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="dashboard-card">
        <h2 className="text-sm font-semibold text-foreground">Payment breakdown</h2>
        <p className="mt-1 text-xs text-muted-foreground">Orders and revenue by payment path</p>
        <div className="mt-4 h-[260px] w-full min-h-[260px] min-w-0">
          <div className="h-full w-full min-w-0" style={{ minHeight: 260 }}>
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              minHeight={260}
              debounce={50}
            >
              <BarChart
                data={paymentChartData}
                margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis
                  dataKey="name"
                  tick={tickSm}
                  interval={0}
                  angle={-12}
                  textAnchor="end"
                  height={56}
                />
                <YAxis
                  yAxisId="orders"
                  allowDecimals={false}
                  tick={tick}
                  width={32}
                />
                <YAxis
                  yAxisId="revenue"
                  orientation="right"
                  tick={tick}
                  width={44}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => {
                    if (name === "revenue" || name === "Revenue") {
                      return [formatMoney(Number(value), currency), "Revenue"];
                    }
                    return [value, "Orders"];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar
                  yAxisId="orders"
                  dataKey="orders"
                  name="Orders"
                  fill="#93C5FD"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="revenue"
                  dataKey="revenue"
                  name="Revenue"
                  fill="#2563EB"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
      </div>

    </div>
  );
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = typeof params.id === "string" ? params.id : "";

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [publicEntryUrl, setPublicEntryUrl] = useState("");

  const [activeTab, setActiveTab] = useState<"configuration" | "analytics">(
    "configuration",
  );
  const [analytics, setAnalytics] = useState<EventAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [configDirty, setConfigDirty] = useState(false);
  const [usage, setUsage] = useState(() => getCachedOrganizationUsage());

  useEffect(() => {
    void getMe().then(() => setUsage(getCachedOrganizationUsage()));
    return subscribeOrganizationUsage(() => {
      setUsage(getCachedOrganizationUsage());
    });
  }, []);

  const canEventAnalytics = usageHasFeature(usage, "analytics_event");

  const isEndedEvent = event?.status === "ended";

  const switchTab = useCallback(
    (tab: "configuration" | "analytics") => {
      if (
        activeTab === "configuration" &&
        tab !== "configuration" &&
        configDirty &&
        !confirmUnsavedChanges()
      ) {
        return;
      }
      setActiveTab(tab);
    },
    [activeTab, configDirty],
  );

  const navigateToOrders = useCallback(() => {
    if (!eventId) return;
    if (
      activeTab === "configuration" &&
      configDirty &&
      !confirmUnsavedChanges()
    ) {
      return;
    }
    router.push(
      `/dashboard/orders?contextType=EVENT&contextId=${encodeURIComponent(eventId)}`,
    );
  }, [activeTab, configDirty, eventId, router]);

  const loadAnalytics = useCallback(async () => {
    if (!eventId) return;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const data = await api<EventAnalytics>(`/api/events/${eventId}/analytics`);
      setAnalytics(data);
    } catch (e) {
      setAnalytics(null);
      setAnalyticsError(
        e instanceof Error ? e.message : "Could not load analytics",
      );
    } finally {
      setAnalyticsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    setAnalytics(null);
    setAnalyticsError(null);
    setCountdownSeconds(null);
    setExportError(null);
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    setError("");
    api<{ event: Event }>(`/api/events/${eventId}`)
      .then((data) => {
        setEvent(data.event);
      })
      .catch(() => setError("Event not found"))
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    if (!event?.id) {
      setPublicEntryUrl("");
      return;
    }
    setPublicEntryUrl(`${window.location.origin}/event/${event.id}`);
  }, [event?.id]);

  useEffect(() => {
    if (!eventId || !event) return;
    if (analytics?.event.eventId === eventId) return;
    if (event.status === "ended") {
      void loadAnalytics();
      return;
    }
    if (activeTab === "analytics" && canEventAnalytics) {
      void loadAnalytics();
    }
  }, [
    eventId,
    event?.status,
    activeTab,
    loadAnalytics,
    analytics?.event.eventId,
  ]);

  useEffect(() => {
    if (!analytics?.event.isEnded) {
      setCountdownSeconds(null);
      return;
    }
    const raw = analytics.event.mediaDeletionCountdownSeconds;
    const clamped = raw == null ? 0 : Math.max(0, raw);
    setCountdownSeconds(clamped);
    if (clamped <= 0) return;

    const id = window.setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev == null || prev <= 0) {
          window.clearInterval(id);
          return 0;
        }
        const next = Math.max(0, prev - 1);
        if (next <= 0) {
          window.clearInterval(id);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [
    analytics?.event.isEnded,
    analytics?.event.mediaDeletionCountdownSeconds,
  ]);

  async function handleToggleActive() {
    if (!event) return;
    const updated = await api<{ event: Event }>(`/api/events/${event.id}`, {
      method: "PATCH",
      body: { isActive: !event.isActive },
    });
    setEvent({
      ...event,
      ...updated.event,
      shapes: updated.event.shapes ?? event.shapes,
      pricing: updated.event.pricing ?? event.pricing,
    });
  }

  async function handleDelete() {
    if (!event) return;
    await api(`/api/events/${event.id}`, { method: "DELETE" });
    router.push("/dashboard/events");
  }

  async function downloadEventArchive() {
    if (!eventId) return;
    if (
      analytics?.event.isEnded &&
      countdownSeconds != null &&
      countdownSeconds <= 0
    ) {
      return;
    }
    const confirmed = window.confirm(
      "This archive contains event order media currently still available. Media may be deleted after the scheduled cleanup time.",
    );
    if (!confirmed) return;

    setExportLoading(true);
    setExportError(null);
    try {
      const res = await fetch(
        `/api/events/${encodeURIComponent(eventId)}/export.zip`,
        {
          credentials: "include",
          cache: "no-store",
        },
      );

      if (!res.ok) {
        let msg = "Could not download archive.";
        try {
          const ct = res.headers.get("Content-Type") ?? "";
          if (ct.includes("application/json")) {
            const j = (await res.json()) as { error?: string };
            if (typeof j.error === "string") msg = j.error;
          }
        } catch {
          /* keep default */
        }
        throw new Error(msg);
      }

      const blob = await res.blob();
      let filename = "event-export.zip";
      const cd = res.headers.get("Content-Disposition");
      const m = /filename="([^"]+)"/i.exec(cd ?? "");
      if (m?.[1]) filename = m[1];

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(
        e instanceof Error ? e.message : "Could not download archive.",
      );
    } finally {
      setExportLoading(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (error || !event) {
    return (
      <DashboardCenteredNotice
        title="This event no longer exists"
        description="It may have been removed. Orders linked to it are still available in Orders."
      >
        <Link
          href="/dashboard/events"
          className="inline-block text-sm font-medium text-primary hover:underline"
        >
          Back to events
        </Link>
      </DashboardCenteredNotice>
    );
  }

  const tabBtn =
    "rounded-lg border px-4 py-2 text-sm font-medium transition-colors";
  const tabIdle = `${tabBtn} border-border bg-background text-foreground hover:bg-surface`;
  const tabActive = `${tabBtn} border-primary bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300`;

  const analyticsBlock = !canEventAnalytics ? (
    <div className="rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
      <p>Event analytics is available on the Hobby plan and above.</p>
      <Link
        href="/dashboard/billing"
        className="mt-3 inline-block font-medium text-primary hover:underline"
      >
        View plans
      </Link>
    </div>
  ) : (
    <>
      {analyticsLoading ? (
        <p className="text-sm text-muted-foreground">Loading analytics…</p>
      ) : null}
      {analyticsError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {analyticsError}
        </div>
      ) : null}
      {analytics && !analyticsLoading ? (
        <EventAnalyticsPanel data={analytics} />
      ) : null}
    </>
  );

  if (isEndedEvent) {
    const delAt = analytics?.event.mediaDeletionAt;
    const retentionReady = analytics && !analyticsLoading;
    const countdownKnown = countdownSeconds != null;
    const showCountdown =
      retentionReady && countdownKnown && countdownSeconds > 0;
    const showCleanupExpired =
      retentionReady && delAt && countdownKnown && countdownSeconds <= 0;
    const exportArchiveBlocked = showCleanupExpired;

    return (
      <div className="dashboard-page">
        <div>
          <Link
            href="/dashboard/events"
            className="-ml-1 inline-block rounded-md px-1 py-0.5 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            &larr; All events
          </Link>
          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {event.name}
              </h1>
              <div className="mt-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE.ended.className}`}
                >
                  {STATUS_BADGE.ended.label}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm font-medium text-[#DC2626] transition-colors hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-muted-foreground">This event has ended. </span>
          <span className="font-medium text-muted-foreground">Event ran: </span>
          {formatDateShort(analytics?.event.startsAt ?? event.startDate)} —{" "}
          {formatDateShort(analytics?.event.endsAt ?? event.endDate)}
        </p>

        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div
          className="rounded-xl border-2 border-amber-400 bg-amber-50 p-5 shadow-sm ring-1 ring-amber-200/90"
          role="region"
          aria-label="Event media retention"
        >
          <h2 className="text-base font-semibold text-amber-950">
            Order media cleanup
          </h2>
          <p className="mt-1 text-sm text-amber-900/90">
            Customer photos from this event are kept for a limited time after the event ends.
            Download the archive before the cleanup time.
          </p>
          {delAt ? (
            <p className="mt-4 text-sm text-amber-950">
              <span className="font-semibold">Scheduled media deletion: </span>
              <span className="tabular-nums">{formatDateShort(delAt)}</span>
            </p>
          ) : analyticsLoading ? (
            <p className="mt-4 text-sm text-amber-900">Loading retention schedule…</p>
          ) : analyticsError ? (
            <p className="mt-4 text-sm text-amber-900">
              Could not load retention schedule. You can still try to download; the server enforces the deadline.
            </p>
          ) : null}
          {showCountdown ? (
            <p className="mt-3 text-sm font-medium text-amber-950">
              <span className="font-semibold">Time remaining: </span>
              {formatCountdown(countdownSeconds!)}
            </p>
          ) : null}
          {showCleanupExpired ? (
            <p className="mt-3 text-sm font-semibold text-amber-950">
              Media cleanup window has expired.
            </p>
          ) : null}
        </div>

        <section className="dashboard-card">
          <h2 className="text-sm font-semibold text-foreground">Event archive</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Download paid-order media before the cleanup deadline.
          </p>
          {exportArchiveBlocked ? (
            <p className="mt-4 text-sm font-medium text-[#92400E]">
              Archive download is no longer available after the media cleanup deadline.
            </p>
          ) : (
            <>
              <button
                type="button"
                disabled={exportLoading}
                onClick={() => void downloadEventArchive()}
                className="mt-4 min-h-[44px] rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exportLoading ? "Preparing download…" : "Download event archive"}
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                Paid orders only. Missing files (cleanup or cloud storage) are listed in MEDIA_SKIPPED.txt when applicable.
              </p>
            </>
          )}
          {exportError ? (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {exportError}
            </p>
          ) : null}
        </section>
        </div>

        {analyticsBlock}
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div>
        <Link
          href="/dashboard/events"
          className="-ml-1 inline-block rounded-md px-1 py-0.5 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
        >
          &larr; All events
        </Link>

        <div className="mt-4 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {event.name}
            </h1>
            <div className="mt-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[event.status].className}`}
              >
                {STATUS_BADGE[event.status].label}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleToggleActive}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
            >
              {event.isActive ? "Deactivate" : "Activate"}
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-[#DC2626] transition-colors hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <div
        className="flex flex-wrap gap-2 border-b border-border pb-2"
        role="tablist"
        aria-label="Event sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "configuration"}
          className={activeTab === "configuration" ? tabActive : tabIdle}
          onClick={() => switchTab("configuration")}
        >
          Configuration
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "analytics"}
          className={activeTab === "analytics" ? tabActive : tabIdle}
          onClick={() => switchTab("analytics")}
        >
          Analytics
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={false}
          className={tabIdle}
          onClick={() => navigateToOrders()}
        >
          Orders
        </button>
      </div>

      {activeTab === "configuration" ? (
        <EventConfigurationForm
          event={event}
          publicEntryUrl={publicEntryUrl}
          onSaved={(updated) => setEvent(updated as Event)}
          onDirtyChange={setConfigDirty}
        />
      ) : (
        analyticsBlock
      )}
    </div>
  );
}
