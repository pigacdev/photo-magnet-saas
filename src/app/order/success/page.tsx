"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { OrderShell } from "@/components/order/OrderShell";
import { OrderStepHeader } from "@/components/order/OrderStepHeader";
import { orderLoadingScreen } from "@/components/order/orderUi";
import {
  getSafeOrderReturnTo,
  orderContextToEntryPath,
} from "@/lib/orderReturnTo";

function OrderSuccessInner() {
  const searchParams = useSearchParams();
  const orderId = useMemo(
    () => searchParams.get("orderId")?.trim() ?? "",
    [searchParams],
  );
  const returnToFromQuery = useMemo(
    () => getSafeOrderReturnTo(searchParams.get("returnTo")),
    [searchParams],
  );

  const editOrderInfoHref = useMemo(() => {
    if (!orderId) return "";
    const p = new URLSearchParams();
    p.set("orderId", orderId);
    p.set("from", "success");
    if (returnToFromQuery) p.set("returnTo", returnToFromQuery);
    return `/order/customer?${p.toString()}`;
  }, [orderId, returnToFromQuery]);

  const startNewOrderHref = returnToFromQuery ?? "/";

  if (!orderId) {
    return (
      <OrderShell contentWidth="medium" className="pb-10">
        <div className="flex flex-col gap-6">
          <OrderStepHeader title="Order submitted" />
          <p className="text-sm text-amber-800">
            This page needs a valid link with your order reference.
          </p>
        </div>
      </OrderShell>
    );
  }

  return (
    <OrderShell contentWidth="medium" className="pb-10">
      <div className="flex flex-col gap-6">
        <OrderStepHeader
          title="Order submitted"
          subtitle="Thank you. The seller will contact you about payment and delivery."
        />

        <p className="text-sm text-[#6B7280]">
          Keep this order reference for your records:
        </p>

        <p className="rounded-xl border border-gray-200 bg-white px-4 py-3 font-mono text-sm text-[#111111] break-all shadow-sm">
          {orderId}
        </p>

        <div className="flex flex-col gap-3 border-t border-gray-200 pt-6">
          <Link
            href={editOrderInfoHref}
            className="inline-flex min-h-[44px] items-center text-sm font-medium text-[#2563EB] underline-offset-4 hover:underline"
          >
            Edit order info
          </Link>
          {startNewOrderHref ? (
            <Link
              href={startNewOrderHref}
              className="inline-flex min-h-[44px] items-center text-sm font-medium text-[#2563EB] underline-offset-4 hover:underline"
            >
              Start new order
            </Link>
          ) : null}
        </div>
      </div>
    </OrderShell>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className={orderLoadingScreen}>
          <p className="text-sm text-[#6B7280]">Loading…</p>
        </div>
      }
    >
      <OrderSuccessInner />
    </Suspense>
  );
}
