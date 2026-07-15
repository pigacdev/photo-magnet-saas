"use client";

import Link from "next/link";
import { useOrganizationUsage } from "@/hooks/useOrganizationUsage";
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
    <div
      className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
        isReached
          ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
          : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
      }`}
      role="status"
    >
      <p>{message}</p>
      <Link
        href="/dashboard/billing"
        className={`mt-2 inline-block font-medium underline ${
          isReached
            ? "text-red-900 dark:text-red-200"
            : "text-amber-950 dark:text-amber-100"
        }`}
      >
        View plans &amp; upgrade
      </Link>
    </div>
  );
}

export function PlanUsageAlertBanner() {
  const usage = useOrganizationUsage();
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
