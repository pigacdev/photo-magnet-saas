"use client";

import Link from "next/link";
import type { OrganizationUsage, User } from "@/lib/auth";
import {
  getPlanUsageLevel,
  usageBarFillClass,
  usagePercentage,
} from "@/lib/planUsage";
import { userInitials } from "./UserProfileSummary";

export type SidebarPlanBadgeProps = {
  user: User;
  usage: OrganizationUsage | null;
};

export function SidebarPlanBadge({ user, usage }: SidebarPlanBadgeProps) {
  const displayName = user.name?.trim() || user.email;
  const usageLevel = usage ? getPlanUsageLevel(usage) : "normal";

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
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-border text-sm font-semibold text-muted-foreground"
          aria-hidden
        >
          {userInitials(user)}
        </div>
        <p className="mt-2 w-full truncate text-sm font-medium text-foreground">
          {displayName}
        </p>

        {usage ? (
          <div className="mt-2 w-full">
            <div className="flex items-center justify-center gap-2">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                  usage.plan === "PRO"
                    ? "bg-blue-50 text-blue-700 dark:text-blue-300 dark:bg-blue-950/40 dark:text-blue-300"
                    : "bg-background text-muted-foreground ring-1 ring-border"
                }`}
              >
                {usage.plan === "PRO" ? "PRO" : "Free"}
              </span>
            </div>

            {usage.plan === "PRO" ? (
              <p className="mt-1.5 text-xs text-green-600 dark:text-green-400">Unlimited orders</p>
            ) : (
              <div className="mt-2 space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Monthly usage</span>
                  <span className="tabular-nums">
                    {usage.ordersThisMonth} / {usage.orderLimit}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-border">
                  <div
                    className={`h-1.5 rounded-full transition-all ${usageBarFillClass(usageLevel)}`}
                    style={{ width: `${usagePercentage(usage)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Loading plan…</p>
        )}
      </div>
    </Link>
  );
}
