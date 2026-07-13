"use client";

import type { OrganizationUsage, User } from "@/lib/auth";
import { getDisplayPreferences } from "@/lib/auth";
import { formatDisplayDate } from "@/lib/dateFormat";
import { planDisplayName } from "@/lib/planCatalog";
import {
  eventUsagePercentage,
  getEventUsageLevel,
  getPlanUsageLevel,
  showMonthlyEventUsageMeter,
  showMonthlyUsageMeter,
  hasCappedMonthlyUsage,
  usageBarFillClassCompact,
  usagePercentage,
} from "@/lib/planUsage";
import { DashboardUserAvatar } from "./DashboardUserAvatar";

function formatPeriodDate(iso: string): string {
  return formatDisplayDate(iso, getDisplayPreferences().dateFormat);
}

function usageResetLabel(usage: OrganizationUsage): string | null {
  if (!hasCappedMonthlyUsage(usage)) return null;
  if (!usage.currentPeriodEnd) return null;
  const date = formatPeriodDate(usage.currentPeriodEnd);
  return `Usage limits reset ${date}`;
}

export function subscriptionRenewLabel(usage: OrganizationUsage): string | null {
  if (!usage.subscriptionRenewsAt) return null;
  if (usage.plan !== "PRO" && usage.plan !== "HOBBY") return null;
  const date = formatPeriodDate(usage.subscriptionRenewsAt);
  return `Plan renews ${date}`;
}

export type UserProfileSummaryProps = {
  user: User;
  usage: OrganizationUsage | null;
  variant: "compact" | "full";
  onSubscriptionChange?: () => void;
  showIdentity?: boolean;
  /** When false, subscription renewal is omitted (e.g. shown in a section header instead). */
  showSubscriptionRenewal?: boolean;
};

export function UserProfileSummary({
  user,
  usage,
  variant,
  showIdentity = true,
  showSubscriptionRenewal = true,
}: UserProfileSummaryProps) {
  const percentage = usage ? usagePercentage(usage) : 0;
  const usageLevel = usage ? getPlanUsageLevel(usage) : "normal";
  const eventPct = usage ? eventUsagePercentage(usage) : 0;
  const eventLevel = usage ? getEventUsageLevel(usage) : "normal";
  const isCompact = variant === "compact";
  const planLabel = usage
    ? (usage.planLabel ?? planDisplayName(usage.plan))
    : null;

  const usageResetText = usage ? usageResetLabel(usage) : null;
  const subscriptionRenewText =
    usage && showSubscriptionRenewal ? subscriptionRenewLabel(usage) : null;

  return (
    <div className={isCompact ? "px-1 py-1" : "space-y-4"}>
      {showIdentity && (
        <div className={`flex items-center gap-3 ${isCompact ? "px-3 pb-3" : ""}`}>
          <DashboardUserAvatar user={user} size={isCompact ? "sm" : "md"} />
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
            {usage.isOnFreeTrial ? (
              <span
                className={`inline-flex rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-200 ${
                  isCompact ? "text-xs" : "text-sm"
                }`}
              >
                Free trial
              </span>
            ) : null}
          </div>

          {showMonthlyUsageMeter(usage) ? (
            <div className="space-y-2">
              <div className={`flex justify-between text-muted-foreground ${isCompact ? "text-xs" : "text-sm"}`}>
                <span>Orders this month</span>
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
            </div>
          ) : null}

          {showMonthlyEventUsageMeter(usage) ? (
            <div className="space-y-2">
              <div className={`flex justify-between text-muted-foreground ${isCompact ? "text-xs" : "text-sm"}`}>
                <span>Events created</span>
                <span className="tabular-nums">
                  {usage.eventsCreatedThisMonth ?? 0} / {usage.eventLimit ?? 1}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-border">
                <div
                  className={`h-1.5 rounded-full transition-all ${usageBarFillClassCompact(eventLevel)}`}
                  style={{ width: `${eventPct}%` }}
                />
              </div>
            </div>
          ) : null}

          {(usageLevel === "warning" || eventLevel === "warning") && (
            <p className={`text-orange-600 ${isCompact ? "text-xs" : "text-sm"}`}>
              You&apos;re close to a monthly limit.
            </p>
          )}
          {(usageLevel === "reached" || eventLevel === "reached") && (
            <p className={`text-red-600 ${isCompact ? "text-xs" : "text-sm"}`}>
              A monthly limit has been reached.
            </p>
          )}

          {(usageResetText || subscriptionRenewText) && (
            <div
              className={`space-y-0.5 text-muted-foreground ${isCompact ? "text-xs" : "text-sm"}`}
            >
              {usageResetText && <p>{usageResetText}</p>}
              {subscriptionRenewText && <p>{subscriptionRenewText}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { formatPeriodDate };
export { userInitials } from "./DashboardUserAvatar";
