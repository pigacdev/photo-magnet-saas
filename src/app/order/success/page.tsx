"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { OrderShell } from "@/components/order/OrderShell";
import { orderAlertError, orderCard, orderLoadingScreen } from "@/components/order/orderUi";
import { formatOrderReference } from "@/lib/orderReference";

function SuccessCheckmark() {
  return (
    <svg
      className="mx-auto size-16 text-[#16A34A] md:size-20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12l2.5 2.5L16 9" />
    </svg>
  );
}

function OrderSuccessInner() {
  const searchParams = useSearchParams();
  const orderId = useMemo(
    () => searchParams.get("orderId")?.trim() ?? "",
    [searchParams],
  );
  const orderReference = useMemo(
    () => (orderId ? formatOrderReference({ id: orderId }) : ""),
    [orderId],
  );

  if (!orderId) {
    return (
      <OrderShell contentWidth="medium" className="pb-10">
        <div className="flex flex-1 flex-col justify-center">
          <div className={`${orderCard} p-6 text-center md:p-8`}>
            <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
              Order submitted
            </h1>
            <p className={`${orderAlertError} mt-6 text-left`}>
              This page needs a valid link with your order reference.
            </p>
          </div>
        </div>
      </OrderShell>
    );
  }

  return (
    <OrderShell contentWidth="medium" className="pb-10">
      <div className="flex flex-1 flex-col justify-center">
        <div className={`${orderCard} flex flex-col items-center gap-6 p-6 text-center md:p-8`}>
          <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
            Order successfully submitted
          </h1>

          <SuccessCheckmark />

          <p className="max-w-md text-base leading-relaxed text-[#6B7280]">
            Thank you. The seller will contact you about payment and delivery.
          </p>

          <div className="flex w-full flex-col items-center gap-2 pt-2">
            <p className="text-sm text-[#6B7280]">
              Keep this order reference for your records
            </p>
            <p className="w-full break-all text-center text-xl font-bold tracking-wide text-[#111111] md:text-2xl">
              {orderReference}
            </p>
          </div>
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
