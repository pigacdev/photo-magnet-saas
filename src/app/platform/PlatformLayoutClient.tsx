"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  getMe,
  getCachedIsPlatformOwner,
  invalidateAuthCache,
} from "@/lib/auth";
import { PlatformShell } from "@/components/platform/PlatformShell";

export function PlatformLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
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
      .then((user) => {
        if (!user) {
          setLoadError(
            "Your account could not be loaded. Try refreshing, or sign out and back in.",
          );
          setChecking(false);
          return;
        }
        if (!getCachedIsPlatformOwner()) {
          router.replace("/dashboard");
          return;
        }
        setAllowed(true);
        setChecking(false);
      })
      .catch(() => {
        setLoadError("Something went wrong loading your account.");
        setChecking(false);
      });
  }, [isLoaded, isSignedIn, getToken, router]);

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

  if (!allowed) return null;

  return <PlatformShell>{children}</PlatformShell>;
}
