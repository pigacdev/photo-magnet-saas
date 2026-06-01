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
      className={`block rounded-lg border p-3 transition-colors hover:bg-gray-100 ${
        usageLevel === "reached"
          ? "border-red-200 bg-red-50/50 hover:bg-red-50"
          : usageLevel === "warning"
            ? "border-amber-200 bg-amber-50/50 hover:bg-amber-50"
            : "border-gray-200 bg-[#F9FAFB]"
      }`}
    >
      <div className="flex flex-col items-center text-center">
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#E5E7EB] text-sm font-semibold text-[#374151]"
          aria-hidden
        >
          {userInitials(user)}
        </div>
        <p className="mt-2 w-full truncate text-sm font-medium text-[#111111]">
          {displayName}
        </p>

        {usage ? (
          <div className="mt-2 w-full">
            <div className="flex items-center justify-center gap-2">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                  usage.plan === "PRO"
                    ? "bg-[#EFF6FF] text-[#1D4ED8]"
                    : "bg-white text-[#374151] ring-1 ring-gray-200"
                }`}
              >
                {usage.plan === "PRO" ? "PRO" : "Free"}
              </span>
            </div>

            {usage.plan === "PRO" ? (
              <p className="mt-1.5 text-xs text-green-600">Unlimited orders</p>
            ) : (
              <div className="mt-2 space-y-1.5">
                <div className="flex justify-between text-xs text-[#374151]">
                  <span>Monthly usage</span>
                  <span className="tabular-nums">
                    {usage.ordersThisMonth} / {usage.orderLimit}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-200">
                  <div
                    className={`h-1.5 rounded-full transition-all ${usageBarFillClass(usageLevel)}`}
                    style={{ width: `${usagePercentage(usage)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-[#6B7280]">Loading plan…</p>
        )}
      </div>
    </Link>
  );
}
