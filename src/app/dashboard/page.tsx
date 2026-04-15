"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getMe,
  getCachedOrganizationUsage,
  type OrganizationUsage,
} from "@/lib/auth";

export default function DashboardPage() {
  const router = useRouter();
  const [usage, setUsage] = useState<OrganizationUsage | null>(null);

  useEffect(() => {
    void getMe().then(() => {
      setUsage(getCachedOrganizationUsage());
    });
  }, []);

  const percentage =
    usage != null &&
    usage.plan === "FREE" &&
    usage.orderLimit > 0
      ? Math.min(
          100,
          Math.round((usage.ordersThisMonth / usage.orderLimit) * 100),
        )
      : 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
          Dashboard
        </h1>
        <p className="mt-2 text-[#6B7280]">
          Manage your events and orders.
        </p>
        {usage && (
          <div className="mt-4">
            <div className="text-sm text-muted-foreground">
              Current plan:{" "}
              <span className="font-medium text-foreground">{usage.plan}</span>
            </div>

            {usage.plan === "PRO" ? (
              <p className="mt-4 text-sm text-green-600">
                Unlimited orders on PRO plan
              </p>
            ) : (
              <>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Monthly usage</span>
                    <span>
                      {usage.ordersThisMonth} /{" "}
                      {usage.orderLimit === 0 ? "∞" : usage.orderLimit}
                    </span>
                  </div>

                  <div className="h-2 w-full rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-black transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>

                {percentage >= 80 && percentage < 100 && (
                  <p className="mt-2 text-sm text-orange-600">
                    You’re close to your monthly limit.
                  </p>
                )}

                {percentage >= 100 && (
                  <p className="mt-2 text-sm text-red-600">
                    You’ve reached your monthly limit. Upgrade to continue.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/billing")}
                  className="mt-2 text-sm underline"
                >
                  Upgrade to PRO
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/orders"
          className="rounded-lg border border-gray-200 p-6 transition-colors hover:border-gray-300 hover:bg-[#F9FAFB]"
        >
          <h2 className="text-base font-medium text-[#111111]">Orders</h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            View orders and download print sheets.
          </p>
        </Link>
        <Link
          href="/dashboard/events"
          className="rounded-lg border border-gray-200 p-6 transition-colors hover:border-gray-300 hover:bg-[#F9FAFB]"
        >
          <h2 className="text-base font-medium text-[#111111]">Events</h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            Create and manage your events.
          </p>
        </Link>
      </div>
    </div>
  );
}
