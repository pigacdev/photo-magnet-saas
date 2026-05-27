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
  PricingEditor,
  PricingPreview,
  type PricingRule,
} from "@/components/PricingEditor";
import { ShareLinkCard } from "@/components/dashboard/ShareLinkCard";

type AllowedShape = {
  id: string;
  shapeType: string;
  widthMm: number;
  heightMm: number;
  displayOrder: number;
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
    className: "bg-blue-50 text-[#2563EB]",
  },
  active: {
    label: "Active",
    className: "bg-green-50 text-[#16A34A]",
  },
  ended: {
    label: "Ended",
    className: "bg-gray-100 text-[#6B7280]",
  },
  inactive: {
    label: "Inactive",
    className: "bg-amber-50 text-[#B45309]",
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
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold tabular-nums text-[#111111]">
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-[#9CA3AF]">{sub}</p> : null}
    </div>
  );
}

function EventAnalyticsPanel({ data }: { data: EventAnalytics }) {
  const { metrics, salesByShape, paymentBreakdown, ordersByDay } = data;
  const currency = metrics.currency || "EUR";

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
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[#111111]">Orders over time</h2>
        <p className="mt-1 text-xs text-[#6B7280]">Count and revenue by day (UTC)</p>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fontSize: 10, fill: "#6B7280" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="orders"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#6B7280" }}
                  width={32}
                />
                <YAxis
                  yAxisId="revenue"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "#6B7280" }}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #E5E7EB",
                    fontSize: "12px",
                  }}
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
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[#111111]">Sales by shape</h2>
        <p className="mt-1 text-xs text-[#6B7280]">Revenue (paid orders, copy-weighted)</p>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#6B7280" }}
                  tickFormatter={(v) => formatMoney(Number(v), currency)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 10, fill: "#6B7280" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #E5E7EB",
                    fontSize: "12px",
                  }}
                  formatter={(value) => [formatMoney(Number(value), currency), "Revenue"]}
                />
                <Bar dataKey="revenue" name="Revenue" fill="#2563EB" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[#111111]">Payment breakdown</h2>
        <p className="mt-1 text-xs text-[#6B7280]">Orders and revenue by payment path</p>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#6B7280" }}
                  interval={0}
                  angle={-12}
                  textAnchor="end"
                  height={56}
                />
                <YAxis
                  yAxisId="orders"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#6B7280" }}
                  width={32}
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
  const [brandDraft, setBrandDraft] = useState("");
  const [brandSaving, setBrandSaving] = useState(false);
  const [notifEmailDraft, setNotifEmailDraft] = useState("");
  const [notifSendDraft, setNotifSendDraft] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<"configuration" | "analytics">(
    "configuration",
  );
  const [analytics, setAnalytics] = useState<EventAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const isEndedEvent = event?.status === "ended";

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
        setBrandDraft(data.event.brandText ?? "");
        setNotifEmailDraft(data.event.notificationEmail ?? "");
        setNotifSendDraft(data.event.sendOrderEmails ?? false);
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
    if (activeTab === "analytics") {
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

  async function saveOrderNotifications() {
    if (!event) return;
    setNotifSaving(true);
    try {
      const updated = await api<{ event: Event }>(`/api/events/${event.id}`, {
        method: "PATCH",
        body: {
          sendOrderEmails: notifSendDraft,
          notificationEmail:
            notifEmailDraft.trim() === "" ? null : notifEmailDraft.trim(),
        },
      });
      setEvent({
        ...event,
        ...updated.event,
        shapes: updated.event.shapes ?? event.shapes,
        pricing: updated.event.pricing ?? event.pricing,
      });
      setNotifEmailDraft(updated.event.notificationEmail ?? "");
      setNotifSendDraft(updated.event.sendOrderEmails ?? false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not save");
    } finally {
      setNotifSaving(false);
    }
  }

  async function saveBrandText() {
    if (!event) return;
    setBrandSaving(true);
    try {
      const updated = await api<{ event: Event }>(`/api/events/${event.id}`, {
        method: "PATCH",
        body: {
          brandText: brandDraft.trim() === "" ? null : brandDraft.trim(),
        },
      });
      setEvent({
        ...event,
        ...updated.event,
        shapes: updated.event.shapes ?? event.shapes,
        pricing: updated.event.pricing ?? event.pricing,
      });
      setBrandDraft(updated.event.brandText ?? "");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBrandSaving(false);
    }
  }

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

  async function handleRemoveShape(shapeId: string) {
    if (!event) return;
    try {
      await api(`/api/events/${event.id}/shapes/${shapeId}`, { method: "DELETE" });
      setEvent({ ...event, shapes: event.shapes.filter((s) => s.id !== shapeId) });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove shape");
    }
  }

  function handlePricingUpdate(
    pricing: PricingRule[],
    meta?: { maxMagnetsPerOrder: number | null },
  ) {
    if (!event) return;
    setEvent({
      ...event,
      pricing,
      ...(meta && { maxMagnetsPerOrder: meta.maxMagnetsPerOrder }),
    });
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
    return <p className="text-sm text-[#6B7280]">Loading…</p>;
  }

  if (error || !event) {
    return (
      <div>
        <p className="text-sm text-[#DC2626]">{error || "Event not found"}</p>
        <Link href="/dashboard/events" className="mt-2 inline-block text-sm text-[#2563EB]">
          Back to events
        </Link>
      </div>
    );
  }

  const tabBtn =
    "rounded-lg border px-4 py-2 text-sm font-medium transition-colors";
  const tabIdle = `${tabBtn} border-gray-300 bg-white text-[#111111] hover:bg-[#F9FAFB]`;
  const tabActive = `${tabBtn} border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]`;

  const analyticsBlock = (
    <>
      {analyticsLoading ? (
        <p className="text-sm text-[#6B7280]">Loading analytics…</p>
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
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <div>
          <Link
            href="/dashboard/events"
            className="-ml-1 inline-block rounded-md px-1 py-0.5 text-sm text-[#6B7280] transition-colors hover:bg-[#F9FAFB] hover:text-[#111111]"
          >
            &larr; All events
          </Link>
          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
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
              className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-[#DC2626] transition-colors hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>

        <p className="text-sm text-[#6B7280]">
          <span className="font-medium text-[#374151]">This event has ended. </span>
          <span className="font-medium text-[#374151]">Event ran: </span>
          {formatDateShort(analytics?.event.startsAt ?? event.startDate)} —{" "}
          {formatDateShort(analytics?.event.endsAt ?? event.endDate)}
        </p>

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

        <div className="rounded-lg border border-gray-200 bg-[#F9FAFB] p-5">
          {exportArchiveBlocked ? (
            <p className="text-sm font-medium text-[#92400E]">
              Archive download is no longer available after the media cleanup deadline.
            </p>
          ) : (
            <>
              <button
                type="button"
                disabled={exportLoading}
                onClick={() => void downloadEventArchive()}
                className="min-h-[44px] rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exportLoading ? "Preparing download…" : "Download event archive"}
              </button>
              <p className="mt-2 max-w-xl text-xs text-[#6B7280]">
                Paid orders only. Missing files (cleanup or cloud storage) are listed in MEDIA_SKIPPED.txt when applicable.
              </p>
            </>
          )}
          {exportError ? (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {exportError}
            </p>
          ) : null}
        </div>

        {analyticsBlock}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <Link
          href="/dashboard/events"
          className="-ml-1 inline-block rounded-md px-1 py-0.5 text-sm text-[#6B7280] transition-colors hover:bg-[#F9FAFB] hover:text-[#111111]"
        >
          &larr; All events
        </Link>

        <div className="mt-4 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
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
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F9FAFB]"
            >
              {event.isActive ? "Deactivate" : "Activate"}
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-[#DC2626] transition-colors hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <div
        className="flex flex-wrap gap-2 border-b border-gray-200 pb-2"
        role="tablist"
        aria-label="Event sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "configuration"}
          className={activeTab === "configuration" ? tabActive : tabIdle}
          onClick={() => setActiveTab("configuration")}
        >
          Configuration
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "analytics"}
          className={activeTab === "analytics" ? tabActive : tabIdle}
          onClick={() => setActiveTab("analytics")}
        >
          Analytics
        </button>
      </div>

      {activeTab === "configuration" ? (
        <>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[#6B7280]">Start</dt>
              <dd className="text-[#111111]">{formatDate(event.startDate)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#6B7280]">End</dt>
              <dd className="text-[#111111]">{formatDate(event.endDate)}</dd>
            </div>
          </dl>

          <div className="rounded-lg border border-gray-200 bg-[#FAFAFA] p-4">
            <h2 className="text-sm font-semibold text-[#111111]">Print branding</h2>
            <p className="mt-1 text-xs text-[#6B7280]">
              Shown on seller PDF print sheets. Max 40 characters. Empty uses
              default <span className="font-mono">@magnetooprints</span>.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-xs font-medium text-[#6B7280]">Brand line</span>
                <input
                  type="text"
                  value={brandDraft}
                  onChange={(e) => setBrandDraft(e.target.value.slice(0, 40))}
                  maxLength={40}
                  placeholder="@magnetooprints"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#111111] outline-none ring-[#2563EB] focus:ring-2"
                />
              </label>
              <button
                type="button"
                disabled={brandSaving}
                onClick={() => void saveBrandText()}
                className="min-h-[44px] rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-50"
              >
                {brandSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-[#FAFAFA] p-4">
            <h2 className="text-sm font-semibold text-[#111111]">Order notifications</h2>
            <p className="mt-1 text-xs text-[#6B7280]">
              When enabled, we email you at the address below each time a customer places an order.
              In production, this address will also be used as the sender for buyer order confirmation emails.
            </p>
            <label className="mt-3 flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB]"
                checked={notifSendDraft}
                onChange={(e) => setNotifSendDraft(e.target.checked)}
              />
              <span className="text-sm text-[#111111]">Send new-order emails</span>
            </label>
            <label className="mt-3 flex flex-col gap-1">
              <span className="text-xs font-medium text-[#6B7280]">Notification email</span>
              <input
                type="email"
                value={notifEmailDraft}
                onChange={(e) => setNotifEmailDraft(e.target.value)}
                placeholder="seller@example.com"
                autoComplete="email"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#111111] outline-none ring-[#2563EB] focus:ring-2"
              />
            </label>
            <button
              type="button"
              disabled={notifSaving}
              onClick={() => void saveOrderNotifications()}
              className="mt-3 min-h-[40px] rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-50"
            >
              {notifSaving ? "Saving…" : "Save notifications"}
            </button>
          </div>

          <ShareLinkCard
            label="Customer link"
            publicUrl={publicEntryUrl}
            variant="event"
            entityName={event.name}
            entityId={event.id}
          />

          <div>
            <h2 className="text-lg font-medium text-[#111111]">Shapes</h2>
            {event.shapes.length === 0 ? (
              <p className="mt-3 text-sm text-[#6B7280]">No shapes configured.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {event.shapes.map((shape) => (
                  <li
                    key={shape.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-sm"
                  >
                    <span className="text-[#111111]">
                      {shape.shapeType.charAt(0) + shape.shapeType.slice(1).toLowerCase()}{" "}
                      {shape.widthMm}×{shape.heightMm} mm
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleRemoveShape(shape.id)}
                      className="text-sm font-medium text-[#DC2626] transition-colors hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="text-lg font-medium text-[#111111]">Pricing</h2>
            {(event.pricing ?? []).length === 0 ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Pricing not configured — customers cannot create orders until pricing is set.
              </p>
            ) : (
              <PricingPreview pricing={event.pricing ?? []} />
            )}
            <PricingEditor
              contextType="event"
              contextId={event.id}
              initialPricing={event.pricing ?? []}
              initialMaxMagnetsPerOrder={event.maxMagnetsPerOrder ?? null}
              onUpdate={handlePricingUpdate}
            />
          </div>
        </>
      ) : (
        analyticsBlock
      )}
    </div>
  );
}
