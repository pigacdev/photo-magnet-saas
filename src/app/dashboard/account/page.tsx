"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getMe,
  getCachedOrganizationUsage,
  type User,
  type OrganizationUsage,
} from "@/lib/auth";
import { getCurrencyLabel } from "@/lib/currency";
import { CopyableAccountId } from "@/components/dashboard/CopyableAccountId";
import { UserProfileSummary } from "@/components/dashboard/UserProfileSummary";

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [usage, setUsage] = useState<OrganizationUsage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getMe().then((u) => {
      setUser(u);
      setUsage(getCachedOrganizationUsage());
      setLoading(false);
    });
  }, []);

  function refreshUsage() {
    setUsage(getCachedOrganizationUsage());
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="dashboard-page mx-auto max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Account
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your profile and subscription details.
        </p>
      </div>

      <section className="dashboard-card">
        <h2 className="text-sm font-semibold text-foreground">Profile</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Name</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {user.name || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="mt-0.5 font-medium text-foreground">{user.email}</dd>
          </div>
          <CopyableAccountId accountId={user.id} variant="definition-list" />
          <div>
            <dt className="text-muted-foreground">Role</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {user.role === "ADMIN" ? "Admin" : "Staff"}
            </dd>
          </div>
          {usage?.currency ? (
            <div>
              <dt className="text-muted-foreground">Order currency</dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {getCurrencyLabel(usage.currency)}
              </dd>
              <dd className="mt-1 text-xs text-muted-foreground">
                Set during initial setup. Used for magnet pricing, orders, and
                analytics. Subscription billing stays in EUR.
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="dashboard-card">
        <h2 className="text-sm font-semibold text-foreground">Plan &amp; usage</h2>
        <div className="mt-4">
          <UserProfileSummary
            user={user}
            usage={usage}
            variant="full"
            showIdentity={false}
            onSubscriptionChange={refreshUsage}
          />
        </div>
        {usage && usage.plan !== "PRO" && (
          <Link
            href="/dashboard/billing"
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            View plans
          </Link>
        )}
      </section>
    </div>
  );
}
