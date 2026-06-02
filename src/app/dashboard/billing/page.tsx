"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getMe,
  getCachedOrganizationUsage,
  invalidateAuthCache,
  type User,
  type OrganizationUsage,
} from "@/lib/auth";
import { UserProfileSummary } from "@/components/dashboard/UserProfileSummary";

function BillingContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");
  const [user, setUser] = useState<User | null>(null);
  const [usage, setUsage] = useState<OrganizationUsage | null>(null);
  const [upgradeError, setUpgradeError] = useState("");
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    void getMe().then((u) => {
      setUser(u);
      setUsage(getCachedOrganizationUsage());
    });
  }, []);

  useEffect(() => {
    if (success === "true") {
      invalidateAuthCache();
      void getMe().then((u) => {
        setUser(u);
        setUsage(getCachedOrganizationUsage());
      });
    }
  }, [success]);

  function refreshUsage() {
    setUsage(getCachedOrganizationUsage());
  }

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

  const plan = usage?.plan ?? null;

  return (
    <div className="dashboard-page mx-auto max-w-2xl">
      {success === "true" && (
        <p className="mb-4 text-sm text-green-600">
          Subscription activated successfully.
        </p>
      )}
      {canceled === "true" && (
        <p className="mb-4 text-sm text-gray-600">
          Checkout was canceled.
        </p>
      )}
      {reason === "limit" && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Free plan limit reached (10 orders per month). Upgrade to PRO to keep
          accepting orders.
        </p>
      )}

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Billing &amp; plan
      </h1>

      <p className="mt-2 text-sm text-muted-foreground">
        Compare benefits and manage your subscription.
      </p>

      {user && usage && (
        <section className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Current plan</h2>
          <div className="mt-4">
            <UserProfileSummary
              user={user}
              usage={usage}
              variant="full"
              showIdentity={false}
              onSubscriptionChange={refreshUsage}
            />
          </div>
        </section>
      )}

      <div className="mt-6 space-y-3 rounded-lg border border-border p-5">
        <p className="text-lg font-semibold text-foreground">
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
          <p className="mt-4 text-sm text-muted-foreground">Loading plan…</p>
        )}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/dashboard" className="text-primary hover:underline">
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
        <div className="dashboard-page mx-auto max-w-2xl text-sm text-muted-foreground">Loading…</div>
      }
    >
      <BillingContent />
    </Suspense>
  );
}
