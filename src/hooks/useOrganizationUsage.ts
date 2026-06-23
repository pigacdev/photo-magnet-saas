"use client";

import { useEffect, useState } from "react";
import {
  getCachedOrganizationUsage,
  subscribeOrganizationUsage,
  type OrganizationUsage,
} from "@/lib/auth";

/** Reactive org usage from the auth cache; updates when preferences or billing change. */
export function useOrganizationUsage(): OrganizationUsage | null {
  const [usage, setUsage] = useState(() => getCachedOrganizationUsage());

  useEffect(() => {
    return subscribeOrganizationUsage(() => {
      setUsage(getCachedOrganizationUsage());
    });
  }, []);

  return usage;
}
