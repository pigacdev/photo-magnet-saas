"use client";

import { OrderFlowBannerProvider } from "@/components/order/OrderFlowBannerContext";

export default function OrderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OrderFlowBannerProvider>{children}</OrderFlowBannerProvider>;
}
