"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  getMe,
  getCachedOrganizationUsage,
  invalidateAuthCache,
  type User,
  type OrganizationUsage,
} from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [usage, setUsage] = useState<OrganizationUsage | null>(null);
  const [checking, setChecking] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }

    invalidateAuthCache();
    void getToken()
      .then(() => getMe())
      .then((u) => {
        if (!u) {
          setLoadError(
            "Your account could not be loaded. Try refreshing, or sign out and back in.",
          );
          setChecking(false);
          return;
        }
        setUser(u);
        setUsage(getCachedOrganizationUsage());
        setChecking(false);
      })
      .catch(() => {
        setLoadError("Something went wrong loading your account.");
        setChecking(false);
      });
  }, [isLoaded, isSignedIn, getToken, router]);

  function refreshUsage() {
    setUsage(getCachedOrganizationUsage());
  }

  if (!isLoaded || checking) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-surface p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-surface p-6">
        <p className="max-w-md text-center text-sm text-[#DC2626]">{loadError}</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <DashboardShell user={user} usage={usage} onUsageRefresh={refreshUsage}>
      {children}
    </DashboardShell>
  );
}
