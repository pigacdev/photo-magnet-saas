"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getMe, invalidateAuthCache } from "@/lib/auth";

function BillingContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");
  const [upgradeError, setUpgradeError] = useState("");
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    if (success === "true") {
      invalidateAuthCache();
      void getMe();
    }
  }, [success]);

  async function startUpgrade() {
    setUpgradeError("");
    setUpgrading(true);
    try {
      const res = await fetch("/api/stripe/create-subscription", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setUpgradeError(data.error ?? "Could not start checkout");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setUpgradeError("Could not start checkout");
    } catch {
      setUpgradeError("Could not start checkout");
    } finally {
      setUpgrading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      {success === "true" && (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          Payment received. Your plan will update to PRO in a few seconds — refresh if needed.
        </p>
      )}
      {canceled === "true" && (
        <p className="mb-4 rounded-lg border border-gray-200 bg-[#F9FAFB] px-4 py-3 text-sm text-[#374151]">
          Checkout canceled. You can try again when you&apos;re ready.
        </p>
      )}
      {reason === "limit" && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Free plan limit reached (10 orders per month). Upgrade to PRO to keep
          accepting orders.
        </p>
      )}

      <h1 className="mb-4 text-xl font-semibold text-[#111111]">Upgrade to PRO</h1>

      <p className="mb-6 text-sm text-[#6B7280]">
        You&apos;ve reached your free limit (10 orders/month).
      </p>

      <div className="rounded-lg border border-gray-200 p-4">
        <p className="font-medium text-[#111111]">PRO — €29/month</p>
        <ul className="mt-2 space-y-1 text-sm text-[#374151]">
          <li>• Unlimited orders</li>
          <li>• Unlimited events</li>
          <li>• 1 storefront</li>
        </ul>

        {upgradeError && (
          <p className="mt-3 text-sm text-red-700">{upgradeError}</p>
        )}

        <button
          type="button"
          disabled={upgrading}
          onClick={() => void startUpgrade()}
          className="mt-4 w-full rounded-lg bg-[#111111] py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {upgrading ? "Redirecting…" : "Upgrade to PRO"}
        </button>
      </div>

      <p className="mt-6 text-sm text-[#6B7280]">
        <Link href="/dashboard" className="text-[#2563EB] hover:underline">
          ← Back to dashboard
        </Link>
      </p>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg p-6 text-sm text-[#6B7280]">Loading…</div>
      }
    >
      <BillingContent />
    </Suspense>
  );
}
