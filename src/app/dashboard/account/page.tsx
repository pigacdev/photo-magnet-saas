"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getMe,
  getCachedOrganizationUsage,
  type User,
  type OrganizationUsage,
} from "@/lib/auth";
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
    return <p className="text-sm text-[#6B7280]">Loading…</p>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="dashboard-page mx-auto max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
          Account
        </h1>
        <p className="mt-2 text-sm text-[#6B7280]">
          Your profile and subscription details.
        </p>
      </div>

      <section className="dashboard-card">
        <h2 className="text-sm font-semibold text-[#111111]">Profile</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-[#6B7280]">Name</dt>
            <dd className="mt-0.5 font-medium text-[#111111]">
              {user.name || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[#6B7280]">Email</dt>
            <dd className="mt-0.5 font-medium text-[#111111]">{user.email}</dd>
          </div>
          <div>
            <dt className="text-[#6B7280]">Role</dt>
            <dd className="mt-0.5 font-medium text-[#111111]">
              {user.role === "ADMIN" ? "Admin" : "Staff"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="dashboard-card">
        <h2 className="text-sm font-semibold text-[#111111]">Plan &amp; usage</h2>
        <div className="mt-4">
          <UserProfileSummary
            user={user}
            usage={usage}
            variant="full"
            showIdentity={false}
            onSubscriptionChange={refreshUsage}
          />
        </div>
        {usage?.plan === "FREE" && (
          <Link
            href="/dashboard/billing"
            className="mt-4 inline-block text-sm font-medium text-[#2563EB] hover:underline"
          >
            Upgrade to PRO
          </Link>
        )}
      </section>
    </div>
  );
}
