"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSafeOrderReturnTo } from "@/lib/orderReturnTo";
import { OrderShell } from "@/components/order/OrderShell";
import { OrderStepHeader } from "@/components/order/OrderStepHeader";

/**
 * Shown after order commit for event (cash) checkout — no online payment.
 */
export default function OrderConfirmationPage() {
  const [continueHref, setContinueHref] = useState("/");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fallback = getSafeOrderReturnTo(params.get("returnTo")) ?? "/";
    setContinueHref(fallback);
  }, []);

  return (
    <OrderShell contentWidth="medium" className="pb-10">
      <div className="flex flex-col gap-6">
        <OrderStepHeader
          title="Order received"
          subtitle="Thank you. Your magnets are reserved. Payment will be collected at the event as arranged."
        />
        <Link
          href={continueHref}
          className="text-sm font-medium text-[#2563EB] underline-offset-4 hover:underline"
        >
          Continue
        </Link>
      </div>
    </OrderShell>
  );
}
