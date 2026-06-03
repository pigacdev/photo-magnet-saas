"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { invalidateAuthCache } from "@/lib/auth";
import { registerClerkTokenGetter } from "@/lib/api";

/** Registers Clerk `getToken` so API calls include a Bearer session token for Express. */
export function ClerkTokenBridge() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  if (isLoaded) {
    registerClerkTokenGetter(() => getToken());
  }

  useEffect(() => {
    return () => registerClerkTokenGetter(null);
  }, []);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      invalidateAuthCache();
    }
  }, [isLoaded, isSignedIn]);

  return null;
}
