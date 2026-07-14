"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getMe, type User } from "@/lib/auth";
import { api } from "@/lib/api";
import { SellerSettingsContent } from "@/components/dashboard/SellerSettingsContent";
import { AccountPrivacyPanel } from "@/components/dashboard/AccountPrivacyPanel";
import { useOrganizationUsage } from "@/hooks/useOrganizationUsage";

function SettingsContent() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [marketingMsg, setMarketingMsg] = useState("");
  const usage = useOrganizationUsage();

  useEffect(() => {
    void getMe().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (searchParams.get("unsubscribe") !== "1") return;
    void api("/api/organization/marketing-preferences", {
      method: "PATCH",
      body: { optOut: true },
    })
      .then(() => setMarketingMsg("You are unsubscribed from marketing emails."))
      .catch(() => setMarketingMsg("Could not update email preferences."));
  }, [searchParams]);

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

      {marketingMsg ? (
        <p className="mt-4 text-sm text-muted-foreground">{marketingMsg}</p>
      ) : null}

      <SellerSettingsContent
        accountId={user.id}
        currency={usage?.currency ?? null}
        organizationName={usage?.name ?? null}
        displayPreferences={{
          dateFormat: usage?.dateFormat ?? "DMY",
          sizeUnit: usage?.sizeUnit ?? "mm",
        }}
      />

      <AccountPrivacyPanel user={user} onUserUpdated={setUser} />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Loading…</p>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
