"use client";

import Link from "next/link";
import { getCachedOrganizationUsage } from "@/lib/auth";
import { hasUnlimitedEvents, hasUnlimitedOrders } from "@/lib/planCatalog";
import { getEventUsageLevel, getPlanUsageLevel } from "@/lib/planUsage";

function UsageAlert({
  message,
  isReached,
}: {
  message: string;
  isReached: boolean;
}) {
  return (
    <div className="relative mb-4" role="status">
      <div
        className={`absolute inset-0 animate-pulse rounded-lg border ${
          isReached
            ? "border-red-200 bg-red-50"
            : "border-amber-200 bg-amber-50"
        }`}
        aria-hidden
      />
      <div
        className={`relative px-4 py-3 text-sm ${
          isReached ? "text-red-800" : "text-amber-950"
        }`}
      >
        <p>{message}</p>
        <Link
          href="/dashboard/billing"
          className={`mt-2 inline-block font-medium underline ${
            isReached ? "text-red-900" : "text-amber-950"
          }`}
        >
          View plans &amp; upgrade
        </Link>
      </div>
    </div>
  );
}

export function PlanUsageAlertBanner() {
  const usage = getCachedOrganizationUsage();
  if (!usage) return null;

  const orderLevel = hasUnlimitedOrders(usage.orderLimit)
    ? "normal"
    : getPlanUsageLevel(usage);
  const eventLevel = hasUnlimitedEvents(usage.eventLimit)
    ? "normal"
    : getEventUsageLevel(usage);

  const alerts: { message: string; isReached: boolean }[] = [];

  if (orderLevel === "reached") {
    alerts.push({
      isReached: true,
      message: `Monthly order limit reached (${usage.ordersThisMonth} / ${usage.orderLimit}). New customer orders are paused until you upgrade or your usage resets.`,
    });
  } else if (orderLevel === "warning") {
    alerts.push({
      isReached: false,
      message: `You've used ${usage.ordersThisMonth} of ${usage.orderLimit} orders this month.`,
    });
  }

  if (eventLevel === "reached") {
    alerts.push({
      isReached: true,
      message: `Monthly event limit reached (${usage.eventsCreatedThisMonth} / ${usage.eventLimit}). You cannot create more events until you upgrade or your usage resets.`,
    });
  } else if (eventLevel === "warning") {
    alerts.push({
      isReached: false,
      message: `You've created ${usage.eventsCreatedThisMonth} of ${usage.eventLimit} events this month.`,
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="mb-6 space-y-0">
      {alerts.map((a) => (
        <UsageAlert key={a.message} message={a.message} isReached={a.isReached} />
      ))}
    </div>
  );
}
