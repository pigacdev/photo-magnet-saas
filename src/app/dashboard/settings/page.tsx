"use client";

import { useEffect, useState } from "react";
import { getMe, type User } from "@/lib/auth";
import { SellerSettingsContent } from "@/components/dashboard/SellerSettingsContent";
import { useOrganizationUsage } from "@/hooks/useOrganizationUsage";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const usage = useOrganizationUsage();

  useEffect(() => {
    void getMe().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

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
          Settings
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Display preferences and shop configuration for your seller account.
        </p>
      </div>

      <SellerSettingsContent
        accountId={user.id}
        currency={usage?.currency ?? null}
        organizationName={usage?.name ?? null}
        displayPreferences={{
          dateFormat: usage?.dateFormat ?? "DMY",
          sizeUnit: usage?.sizeUnit ?? "mm",
        }}
      />
    </div>
  );
}
