"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getMe,
  getCachedOrganizationUsage,
  invalidateAuthCache,
} from "@/lib/auth";

function BillingContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");
  const [plan, setPlan] = useState<"FREE" | "PRO" | null>(null);
  const [upgradeError, setUpgradeError] = useState("");
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    void getMe().then(() => {
      setPlan(getCachedOrganizationUsage()?.plan ?? null);
    });
  }, []);

  useEffect(() => {
    if (success === "true") {
      invalidateAuthCache();
      void getMe().then(() => {
        setPlan(getCachedOrganizationUsage()?.plan ?? null);
      });
    }
  }, [success]);

  async function handleUpgrade() {
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
        <p className="mb-4 text-sm text-green-600">
          Subscription activated successfully 🎉
        </p>
      )}
      {canceled === "true" && (
        <p className="mb-4 text-sm text-gray-600">
          Subscription was canceled.
        </p>
      )}
      {reason === "limit" && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Free plan limit reached (10 orders per month). Upgrade to PRO to keep
          accepting orders.
        </p>
      )}

      <h2 className="text-lg font-semibold text-[#111111]">
        Your plan: {plan ?? "…"}
      </h2>

      <p className="mt-2 text-sm text-[#6B7280]">
        Compare benefits and upgrade when you&apos;re ready.
      </p>

      <div className="mt-6 space-y-3 rounded-lg border border-gray-200 p-5">
        <p className="text-lg font-semibold text-[#111111]">
          PRO — €29/month
        </p>

        <ul className="space-y-1 text-sm text-gray-600">
          <li>✔ Unlimited orders</li>
          <li>✔ Unlimited events</li>
          <li>✔ 1 storefront</li>
          <li>✔ Priority workflow</li>
        </ul>

        {upgradeError && (
          <p className="text-sm text-red-700">{upgradeError}</p>
        )}

        {plan === "FREE" ? (
          <>
            <p className="mt-4 text-sm text-gray-600">
              Upgrade to remove limits and keep accepting orders without
              interruption.
            </p>
            <button
              type="button"
              disabled={upgrading}
              onClick={() => void handleUpgrade()}
              className="mt-4 w-full rounded bg-black py-2 text-white disabled:opacity-60"
            >
              {upgrading ? "Redirecting…" : "Upgrade to PRO"}
            </button>
          </>
        ) : plan === "PRO" ? (
          <p className="mt-4 text-sm text-green-600">
            You are currently on PRO plan
          </p>
        ) : (
          <p className="mt-4 text-sm text-gray-500">Loading plan…</p>
        )}
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
