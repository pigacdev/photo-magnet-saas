"use client";

import type { OrganizationUsage, User } from "@/lib/auth";
import { planDisplayName } from "@/lib/planCatalog";
import {
  getPlanUsageLevel,
  showMonthlyUsageMeter,
  usageBarFillClassCompact,
  usagePercentage,
} from "@/lib/planUsage";

function formatPeriodDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function userInitials(user: User): string {
  if (user.name?.trim()) {
    const parts = user.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  return user.email.slice(0, 2).toUpperCase();
}

export type UserProfileSummaryProps = {
  user: User;
  usage: OrganizationUsage | null;
  variant: "compact" | "full";
  onSubscriptionChange?: () => void;
  showIdentity?: boolean;
};

export function UserProfileSummary({
  user,
  usage,
  variant,
  showIdentity = true,
}: UserProfileSummaryProps) {
  const percentage = usage ? usagePercentage(usage) : 0;
  const usageLevel = usage ? getPlanUsageLevel(usage) : "normal";
  const isCompact = variant === "compact";
  const planLabel = usage
    ? (usage.planLabel ?? planDisplayName(usage.plan))
    : null;

  function periodLabel(): string | null {
    if (!usage?.currentPeriodEnd) return null;
    const date = formatPeriodDate(usage.currentPeriodEnd);
    if (usage.plan === "PRO" || usage.plan === "HOBBY") {
      return `Usage resets ${date}`;
    }
    return `Usage resets ${date}`;
  }

  return (
    <div className={isCompact ? "px-1 py-1" : "space-y-4"}>
      {showIdentity && (
        <div className={`flex items-center gap-3 ${isCompact ? "px-3 pb-3" : ""}`}>
          <div
            className={`flex shrink-0 items-center justify-center rounded-full bg-surface font-medium text-muted-foreground ${
              isCompact ? "size-9 text-xs" : "size-11 text-sm"
            }`}
            aria-hidden
          >
            {userInitials(user)}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`truncate font-medium text-foreground ${
                isCompact ? "text-sm" : "text-base"
              }`}
            >
              {user.name || user.email}
            </p>
            {user.name && (
              <p className={`truncate text-muted-foreground ${isCompact ? "text-xs" : "text-sm"}`}>
                {user.email}
              </p>
            )}
          </div>
        </div>
      )}

      {usage && planLabel && (
        <div className={isCompact ? "space-y-2 px-3 pb-1" : "space-y-3"}>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 font-medium ${
                usage.plan === "PRO"
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                  : usage.plan === "HOBBY"
                    ? "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                    : "bg-surface text-muted-foreground"
              } ${isCompact ? "text-xs" : "text-sm"}`}
            >
              {planLabel}
            </span>
            <span className={`text-muted-foreground ${isCompact ? "text-xs" : "text-sm"}`}>
              {user.role === "ADMIN" ? "Admin" : "Staff"}
            </span>
          </div>

          {!showMonthlyUsageMeter(usage) ? (
            <p className={`text-green-600 ${isCompact ? "text-xs" : "text-sm"}`}>
              Unlimited orders
            </p>
          ) : (
            <div className="space-y-2">
              <div className={`flex justify-between text-muted-foreground ${isCompact ? "text-xs" : "text-sm"}`}>
                <span>Monthly usage</span>
                <span className="tabular-nums">
                  {usage.ordersThisMonth} / {usage.orderLimit}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-border">
                <div
                  className={`h-1.5 rounded-full transition-all ${usageBarFillClassCompact(usageLevel)}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              {usageLevel === "warning" && (
                <p className={`text-orange-600 ${isCompact ? "text-xs" : "text-sm"}`}>
                  You&apos;re close to your monthly limit.
                </p>
              )}
              {usageLevel === "reached" && (
                <p className={`text-red-600 ${isCompact ? "text-xs" : "text-sm"}`}>
                  Monthly limit reached.
                </p>
              )}
            </div>
          )}

          {periodLabel() && (
            <p className={`text-muted-foreground ${isCompact ? "text-xs" : "text-sm"}`}>
              {periodLabel()}
            </p>
          )}

          {!isCompact && (usage.plan === "PRO" || usage.plan === "HOBBY") && (
            <p className="text-sm text-muted-foreground">
              Change or cancel your subscription in Plans below.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export { userInitials, formatPeriodDate };
