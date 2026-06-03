"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { registerClerkTokenGetter } from "@/lib/api";

/** Registers Clerk `getToken` so API calls include a Bearer session token for Express. */
export function ClerkTokenBridge() {
  const { getToken, isLoaded } = useAuth();

  if (isLoaded) {
    registerClerkTokenGetter(() => getToken());
  }

  useEffect(() => {
    return () => registerClerkTokenGetter(null);
  }, []);

  return null;
}
