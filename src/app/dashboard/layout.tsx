"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  getMe,
  getCachedOrganizationUsage,
  invalidateAuthCache,
  subscribeOrganizationUsage,
  type User,
  type OrganizationUsage,
} from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { OnboardingModal } from "@/components/dashboard/OnboardingModal";
import { LegalReconsentModal } from "@/components/dashboard/LegalReconsentModal";
import { UnsavedChangesProvider } from "@/components/dashboard/UnsavedChangesProvider";

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

    void getToken()
      .then(() => {
        invalidateAuthCache();
        return getMe();
      })
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

  useEffect(() => {
    return subscribeOrganizationUsage(() => {
      setUsage(getCachedOrganizationUsage());
    });
  }, []);

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

  const needsOnboarding = usage != null && usage.currency == null;
  const needsLegalReconsent = user.needsLegalReconsent === true;

  async function handleOnboardingCompleted() {
    invalidateAuthCache();
    const u = await getMe();
    if (u) {
      setUser(u);
      setUsage(getCachedOrganizationUsage());
    }
  }

  async function handleLegalReconsentCompleted() {
    invalidateAuthCache();
    const u = await getMe();
    if (u) {
      setUser(u);
      setUsage(getCachedOrganizationUsage());
    }
  }

  return (
    <>
      <UnsavedChangesProvider>
        <DashboardShell user={user} usage={usage}>
          {children}
        </DashboardShell>
      </UnsavedChangesProvider>
      {needsLegalReconsent && !needsOnboarding ? (
        <LegalReconsentModal onCompleted={handleLegalReconsentCompleted} />
      ) : null}
      {needsOnboarding ? (
        <OnboardingModal onCompleted={handleOnboardingCompleted} />
      ) : null}
    </>
  );
}
