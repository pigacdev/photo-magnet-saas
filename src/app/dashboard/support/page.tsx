"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  getMe,
  getCachedOrganizationUsage,
  type User,
  type OrganizationUsage,
} from "@/lib/auth";
import { usageHasFeature } from "@/lib/planFeatures";
import {
  SupportTicketForm,
  type SupportTicketInitialContext,
} from "@/components/dashboard/SupportTicketForm";
import { SupportSocialLinks } from "@/components/dashboard/SupportSocialLinks";

function parseInitialContext(
  searchParams: URLSearchParams,
): SupportTicketInitialContext | undefined {
  const contextTypeRaw = searchParams.get("contextType");
  const contextType =
    contextTypeRaw === "GENERAL" ||
    contextTypeRaw === "EVENT" ||
    contextTypeRaw === "STOREFRONT" ||
    contextTypeRaw === "ORDER"
      ? contextTypeRaw
      : undefined;

  const contextId = searchParams.get("contextId")?.trim() || undefined;
  const orderId = searchParams.get("orderId")?.trim() || undefined;

  if (!contextType && !contextId && !orderId) {
    return undefined;
  }

  return {
    contextType: contextType ?? (orderId ? "ORDER" : undefined),
    contextId,
    orderId,
  };
}

function SupportPageContent() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [usage, setUsage] = useState<OrganizationUsage | null>(null);
  const [loading, setLoading] = useState(true);

  const initialContext = useMemo(
    () => parseInitialContext(searchParams),
    [searchParams],
  );

  useEffect(() => {
    void getMe().then((u) => {
      setUser(u);
      setUsage(getCachedOrganizationUsage());
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (!user) {
    return null;
  }

  const hasSupport = usageHasFeature(usage, "support");
  const isPriority = usageHasFeature(usage, "priority_support");

  return (
    <div className="dashboard-page mx-auto max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Contact support
        </h1>
        {hasSupport ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {isPriority
              ? "Pro priority support — your tickets are answered first. Include as much detail as you can."
              : "Tell us what you need help with. Include as much detail as you can so we can respond quickly."}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Support tickets are available on the Hobby plan or higher.
          </p>
        )}
      </div>

      {!hasSupport ? (
        <section className="dashboard-card mt-6">
          <h2 className="text-sm font-semibold text-foreground">
            Contact support requires a paid plan
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Upgrade to Hobby or Pro to submit support tickets and get help from
            the Magnetoo team.
          </p>
          <Link
            href="/dashboard/billing"
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            View plans
          </Link>
          <div className="mt-6 border-t border-border pt-6">
            <SupportSocialLinks />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            <Link href="/dashboard" className="text-primary hover:underline">
              ← Back to dashboard
            </Link>
          </p>
        </section>
      ) : (
        <div className="mt-6">
          <SupportTicketForm user={user} initialContext={initialContext} />
        </div>
      )}
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <SupportPageContent />
    </Suspense>
  );
}
