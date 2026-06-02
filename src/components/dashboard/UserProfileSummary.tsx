"use client";

import { useState } from "react";
import type { OrganizationUsage, User } from "@/lib/auth";
import { invalidateAuthCache, getMe } from "@/lib/auth";
import {
  getPlanUsageLevel,
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
  onSubscriptionChange,
  showIdentity = true,
}: UserProfileSummaryProps) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const percentage = usage ? usagePercentage(usage) : 0;
  const usageLevel = usage ? getPlanUsageLevel(usage) : "normal";
  const isCompact = variant === "compact";

  async function refreshAfterAction() {
    invalidateAuthCache();
    await getMe();
    onSubscriptionChange?.();
  }

  async function handleCancel() {
    setActionError("");
    setActionLoading(true);
    try {
      const res = await fetch("/api/stripe/cancel-subscription", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setActionError(data.error ?? "Could not cancel subscription");
        return;
      }
      setConfirmCancel(false);
      await refreshAfterAction();
    } catch {
      setActionError("Could not cancel subscription");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReactivate() {
    setActionError("");
    setActionLoading(true);
    try {
      const res = await fetch("/api/stripe/reactivate-subscription", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setActionError(data.error ?? "Could not reactivate subscription");
        return;
      }
      await refreshAfterAction();
    } catch {
      setActionError("Could not reactivate subscription");
    } finally {
      setActionLoading(false);
    }
  }

  function periodLabel(): string | null {
    if (!usage?.currentPeriodEnd) return null;
    const date = formatPeriodDate(usage.currentPeriodEnd);
    if (usage.plan === "PRO") {
      return usage.cancelAtPeriodEnd
        ? `Access until ${date}`
        : `Renews ${date}`;
    }
    return `Usage resets ${date}`;
  }

  return (
    <div className={isCompact ? "px-1 py-1" : "space-y-4"}>
      {showIdentity && (
        <div className={`flex items-center gap-3 ${isCompact ? "px-3 pb-3" : ""}`}>
          <div
            className={`flex shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] font-medium text-[#374151] ${
              isCompact ? "size-9 text-xs" : "size-11 text-sm"
            }`}
            aria-hidden
          >
            {userInitials(user)}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`truncate font-medium text-[#111111] ${
                isCompact ? "text-sm" : "text-base"
              }`}
            >
              {user.name || user.email}
            </p>
            {user.name && (
              <p className={`truncate text-[#6B7280] ${isCompact ? "text-xs" : "text-sm"}`}>
                {user.email}
              </p>
            )}
          </div>
        </div>
      )}

      {usage && (
        <div className={isCompact ? "space-y-2 px-3 pb-1" : "space-y-3"}>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 font-medium ${
                usage.plan === "PRO"
                  ? "bg-[#EFF6FF] text-[#1D4ED8]"
                  : "bg-[#F3F4F6] text-[#374151]"
              } ${isCompact ? "text-xs" : "text-sm"}`}
            >
              {usage.plan}
            </span>
            <span className={`text-[#6B7280] ${isCompact ? "text-xs" : "text-sm"}`}>
              {user.role === "ADMIN" ? "Admin" : "Staff"}
            </span>
          </div>

          {usage.plan === "PRO" ? (
            <p className={`text-green-600 ${isCompact ? "text-xs" : "text-sm"}`}>
              Unlimited orders
            </p>
          ) : (
            <div className="space-y-2">
              <div className={`flex justify-between text-[#374151] ${isCompact ? "text-xs" : "text-sm"}`}>
                <span>Monthly usage</span>
                <span className="tabular-nums">
                  {usage.ordersThisMonth} / {usage.orderLimit}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-200">
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
            <p className={`text-[#6B7280] ${isCompact ? "text-xs" : "text-sm"}`}>
              {periodLabel()}
            </p>
          )}

          {!isCompact && usage.plan === "PRO" && !usage.cancelAtPeriodEnd && (
            <div className={isCompact ? "pt-1" : "pt-2"}>
              {!confirmCancel ? (
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  className={`font-medium text-[#DC2626] transition-colors hover:text-red-700 ${
                    isCompact ? "text-xs" : "text-sm"
                  }`}
                >
                  Cancel subscription
                </button>
              ) : (
                <div className={`space-y-2 rounded-md border border-gray-200 bg-[#F9FAFB] p-3 ${isCompact ? "text-xs" : "text-sm"}`}>
                  <p className="text-[#374151]">
                    You&apos;ll keep PRO until{" "}
                    {usage.currentPeriodEnd
                      ? formatPeriodDate(usage.currentPeriodEnd)
                      : "the end of your billing period"}
                    . After that you&apos;ll be on the Free plan.
                  </p>
                  {actionError && (
                    <p className="text-red-600">{actionError}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => void handleCancel()}
                      className="rounded-md bg-[#111111] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                    >
                      {actionLoading ? "Canceling…" : "Confirm cancel"}
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => {
                        setConfirmCancel(false);
                        setActionError("");
                      }}
                      className="rounded-md px-3 py-1.5 text-xs font-medium text-[#6B7280] hover:text-[#111111]"
                    >
                      Keep subscription
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isCompact && usage.plan === "PRO" && usage.cancelAtPeriodEnd && (
            <div className={isCompact ? "pt-1" : "pt-2"}>
              <p className={`text-orange-600 ${isCompact ? "text-xs" : "text-sm"}`}>
                Subscription will not renew.
              </p>
              {actionError && (
                <p className={`mt-1 text-red-600 ${isCompact ? "text-xs" : "text-sm"}`}>
                  {actionError}
                </p>
              )}
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void handleReactivate()}
                className={`mt-1 font-medium text-[#2563EB] hover:underline disabled:opacity-60 ${
                  isCompact ? "text-xs" : "text-sm"
                }`}
              >
                {actionLoading ? "Updating…" : "Keep subscription"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { userInitials, formatPeriodDate };
