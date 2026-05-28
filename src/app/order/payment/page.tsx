"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { OrderShell } from "@/components/order/OrderShell";
import { OrderStepHeader } from "@/components/order/OrderStepHeader";
import { orderBtnPrimary, orderCard, orderLoadingScreen } from "@/components/order/orderUi";

type CheckoutSessionResponse = {
  url: string;
};

/** Storefront Stripe step: driven only by `?orderId=` — middleware and API do not require an order session cookie. */
function OrderPaymentInner() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId")?.trim() ?? "";

  const [backHref, setBackHref] = useState("/order/review");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = window.location.search;
    setBackHref(`/order/customer${q}`);
  }, []);

  const onPay = useCallback(async () => {
    if (!orderId) {
      setError("Missing order. Return to review and place the order again.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await api<CheckoutSessionResponse>("/api/stripe/checkout-session", {
        method: "POST",
        body: { orderId },
      });
      if (res.url) {
        window.location.href = res.url;
        return;
      }
      setError("Could not start checkout.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  return (
    <OrderShell contentWidth="medium" className="pb-10">
      <div className="flex flex-col gap-6">
        <OrderStepHeader
          title="Payment"
          subtitle="Pay securely with card. Your order is already created; completing checkout charges this order only."
          step={{ current: 6, total: 6, label: "Payment" }}
        />
      {orderId ? (
        <p className={`${orderCard} font-mono text-xs text-[#111111] break-all`}>
          Order: {orderId}
        </p>
      ) : (
        <p className="text-sm text-amber-800">
          No order id found. Go back and use &quot;Proceed to payment&quot; again.
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={loading || !orderId}
        onClick={() => void onPay()}
        className={orderBtnPrimary}
      >
        {loading ? "Starting checkout…" : "Pay now"}
      </button>
      <Link
        href={backHref}
        className="text-sm font-medium text-[#2563EB] underline-offset-4 hover:underline"
      >
        Back to customer details
      </Link>
      </div>
    </OrderShell>
  );
}

export default function OrderPaymentPage() {
  return (
    <Suspense
      fallback={
        <div className={orderLoadingScreen}>
          <p className="text-sm text-[#6B7280]">Loading…</p>
        </div>
      }
    >
      <OrderPaymentInner />
    </Suspense>
  );
}
