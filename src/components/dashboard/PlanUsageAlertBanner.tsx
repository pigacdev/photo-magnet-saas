"use client";

import Link from "next/link";
import { getCachedOrganizationUsage } from "@/lib/auth";
import { hasUnlimitedOrders } from "@/lib/planCatalog";
import { getPlanUsageLevel } from "@/lib/planUsage";

export function PlanUsageAlertBanner() {
  const usage = getCachedOrganizationUsage();
  if (!usage || hasUnlimitedOrders(usage.orderLimit)) return null;

  const level = getPlanUsageLevel(usage);
  if (level === "normal") return null;

  const isReached = level === "reached";

  return (
    <div className="relative mb-6" role="status">
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
        {isReached ? (
          <p>
            Monthly order limit reached ({usage.ordersThisMonth} / {usage.orderLimit}
            ). New customer orders are paused until you upgrade or your usage resets.
          </p>
        ) : (
          <p>
            You&apos;ve used {usage.ordersThisMonth} of {usage.orderLimit} orders this
            month. Upgrade your plan to avoid interruptions.
          </p>
        )}
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
