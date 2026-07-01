"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { GetSessionResponse } from "@/lib/orderSessionTypes";

const OrderFlowBannerContext = createContext<string | null>(null);

export function OrderFlowBannerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  useEffect(() => {
    api<GetSessionResponse>("/api/session")
      .then((data) => {
        if (data.session?.contextType !== "event") {
          setBannerUrl(null);
          return;
        }
        setBannerUrl(data.event?.bannerUrl ?? null);
      })
      .catch(() => setBannerUrl(null));
  }, []);

  return (
    <OrderFlowBannerContext.Provider value={bannerUrl}>
      {children}
    </OrderFlowBannerContext.Provider>
  );
}

export function useOrderFlowBanner(): string | null {
  return useContext(OrderFlowBannerContext);
}
