"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PricingTable } from "@clerk/nextjs";
import "./billing-plans.css";
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
  const [user, setUser] = useState<User | null>(null);
  const [usage, setUsage] = useState<OrganizationUsage | null>(null);

  function refreshAccount() {
    invalidateAuthCache();
    return getMe().then((u) => {
      setUser(u);
      setUsage(getCachedOrganizationUsage());
    });
  }

  useEffect(() => {
    void refreshAccount();
  }, []);

  useEffect(() => {
    if (success === "true") {
      void refreshAccount();
    }
  }, [success]);

  return (
    <div className="dashboard-page mx-auto max-w-6xl">
      {success === "true" && (
        <p className="mb-4 text-sm text-green-600">
          Subscription updated. It may take a moment for usage limits to sync.
        </p>
      )}
      {reason === "limit" && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Monthly order limit reached. Upgrade to keep accepting orders.
        </p>
      )}

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Billing &amp; plan
      </h1>

      <p className="mt-2 text-sm text-muted-foreground">
        Compare plans, upgrade, or manage your subscription. Payment methods,
        invoices, and cancellation are handled in the plan manager below.
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
            />
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-foreground">Plans</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Free includes 10 orders per month. Paid plans raise or remove that cap.
        </p>
        <div className="mt-4 clerk-pricing-table">
          <PricingTable
            for="user"
            highlightedPlan="pro"
            newSubscriptionRedirectUrl="/dashboard/billing?success=true"
            appearance={{
              elements: {
                pricingTable: "magnetoo-clerk-pricing-table",
              },
            }}
          />
        </div>
      </section>

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
        <div className="dashboard-page mx-auto max-w-6xl text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <BillingContent />
    </Suspense>
  );
}
