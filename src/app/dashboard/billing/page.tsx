"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PricingTable } from "@clerk/nextjs";
import "./billing-plans.css";
import {
  getMe,
  getCachedEarlyAccessStatus,
  getCachedOrganizationUsage,
  invalidateAuthCache,
  type User,
  type OrganizationUsage,
} from "@/lib/auth";
import { BillingPlanFeatureLists } from "@/components/dashboard/BillingPlanFeatureLists";
import { BillingEarlyAccessPlanBanners } from "@/components/dashboard/BillingEarlyAccessPlanBanners";
import { BillingSubscriptionSuccessModal } from "@/components/dashboard/BillingSubscriptionSuccessModal";
import { UserProfileSummary } from "@/components/dashboard/UserProfileSummary";
import type { EarlyAccessStatus } from "@/lib/earlyAccessUi";

function BillingContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const success = searchParams.get("success");
  const [user, setUser] = useState<User | null>(null);
  const [usage, setUsage] = useState<OrganizationUsage | null>(null);
  const [earlyAccess, setEarlyAccess] = useState<EarlyAccessStatus | null>(
    () => getCachedEarlyAccessStatus(),
  );
  const [successModalOpen, setSuccessModalOpen] = useState(
    success === "true",
  );

  function dismissSuccessModal() {
    setSuccessModalOpen(false);
    router.replace(pathname);
  }

  function refreshAccount() {
    invalidateAuthCache();
    return getMe().then((u) => {
      setUser(u);
      setUsage(getCachedOrganizationUsage());
      setEarlyAccess(getCachedEarlyAccessStatus());
    });
  }

  useEffect(() => {
    void refreshAccount();
  }, []);

  useEffect(() => {
    if (success === "true") {
      setSuccessModalOpen(true);
      void refreshAccount();
    }
  }, [success]);

  return (
    <div className="dashboard-page mx-auto max-w-6xl">
      <BillingSubscriptionSuccessModal
        open={successModalOpen}
        onClose={dismissSuccessModal}
      />
      {reason === "limit" && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Monthly order or event limit reached. Upgrade to keep accepting orders or
          create more events.
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
          Choose or change your plan below. Current plan shows monthly order and
          event limits, when those limits reset, and when your paid subscription
          renews.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Subscription prices are billed in EUR. Your order currency (chosen at
          setup) applies to customer magnet pricing only.
        </p>
        <div
          className={`billing-plans-layout mt-4${earlyAccess?.isOpen ? " billing-plans-layout--early-access" : ""}`}
        >
          <BillingEarlyAccessPlanBanners status={earlyAccess} />
          <div className="clerk-pricing-table">
            <PricingTable
              for="user"
              highlightedPlan="pro"
              collapseFeatures={false}
              newSubscriptionRedirectUrl="/dashboard/billing?success=true"
              appearance={{
                elements: {
                  pricingTable: "magnetoo-clerk-pricing-table",
                  pricingTableCard: "magnetoo-clerk-pricing-card",
                  pricingTableCardFeatures: "magnetoo-clerk-hide-features",
                },
              }}
            />
          </div>
          <BillingPlanFeatureLists
            earlyAccessOpen={earlyAccess?.isOpen ?? false}
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
