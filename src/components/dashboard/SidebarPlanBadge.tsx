"use client";

import Link from "next/link";
import type { OrganizationUsage, User } from "@/lib/auth";
import { planDisplayName } from "@/lib/planCatalog";
import {
  getEventUsageLevel,
  getPlanUsageLevel,
  eventUsagePercentage,
  showMonthlyEventUsageMeter,
  showMonthlyUsageMeter,
  usageBarFillClass,
  usagePercentage,
} from "@/lib/planUsage";
import { DashboardUserAvatar } from "./DashboardUserAvatar";

export type SidebarPlanBadgeProps = {
  user: User;
  usage: OrganizationUsage | null;
};

export function SidebarPlanBadge({ user, usage }: SidebarPlanBadgeProps) {
  const displayName = user.name?.trim() || user.email;
  const orderLevel = usage ? getPlanUsageLevel(usage) : "normal";
  const eventLevel = usage ? getEventUsageLevel(usage) : "normal";
  const usageLevel =
    orderLevel === "reached" || eventLevel === "reached"
      ? "reached"
      : orderLevel === "warning" || eventLevel === "warning"
        ? "warning"
        : "normal";
  const label = usage ? (usage.planLabel ?? planDisplayName(usage.plan)) : null;

  return (
    <Link
      href="/dashboard/billing"
      className={`block rounded-lg border p-3 transition-colors hover:bg-surface ${
        usageLevel === "reached"
          ? "border-red-200 bg-red-50/50 hover:bg-red-50 dark:border-red-900 dark:bg-red-950/30 dark:hover:bg-red-950/50"
          : usageLevel === "warning"
            ? "border-amber-200 bg-amber-50/50 hover:bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
            : "border-border bg-surface"
      }`}
    >
      <div className="flex flex-col items-center text-center">
        <DashboardUserAvatar user={user} size="md" />
        <p className="mt-2 w-full truncate text-sm font-medium text-foreground">
          {displayName}
        </p>

        {usage && label ? (
          <div className="mt-2 w-full">
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                  usage.plan === "PRO"
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    : usage.plan === "HOBBY"
                      ? "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                      : "bg-background text-muted-foreground ring-1 ring-border"
                }`}
              >
                {label}
              </span>
              {usage.isOnFreeTrial ? (
                <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                  Free trial
                </span>
              ) : null}
            </div>

            {showMonthlyUsageMeter(usage) ? (
              <div className="mt-2 space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Orders</span>
                  <span className="tabular-nums">
                    {usage.ordersThisMonth} / {usage.orderLimit}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-border">
                  <div
                    className={`h-1.5 rounded-full transition-all ${usageBarFillClass(orderLevel)}`}
                    style={{ width: `${usagePercentage(usage)}%` }}
                  />
                </div>
              </div>
            ) : null}

            {showMonthlyEventUsageMeter(usage) ? (
              <div className="mt-2 space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Events</span>
                  <span className="tabular-nums">
                    {usage.eventsCreatedThisMonth ?? 0} / {usage.eventLimit ?? 1}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-border">
                  <div
                    className={`h-1.5 rounded-full transition-all ${usageBarFillClass(eventLevel)}`}
                    style={{ width: `${eventUsagePercentage(usage)}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Loading plan…</p>
        )}
      </div>
    </Link>
  );
}
