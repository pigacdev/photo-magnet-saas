"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type StorefrontSummary = {
  id: string;
  name: string;
};

export function useSellerStorefront() {
  const [storefront, setStorefront] = useState<StorefrontSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ storefronts: StorefrontSummary[] }>("/api/storefronts")
      .then((data) => setStorefront(data.storefronts[0] ?? null))
      .catch(() => setStorefront(null))
      .finally(() => setLoading(false));
  }, []);

  return { storefront, loading };
}
