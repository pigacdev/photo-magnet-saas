"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";
import { api } from "@/lib/api";

type CheckoutSessionResponse = {
  url: string;
};

/** Stripe checkout: `?orderId=` + optional `returnTo` (middleware / API use session cookie when present). */
function OrderPaymentInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId")?.trim() ?? "";

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /**
   * Back to order details — same for storefront and event.
   * Preserves all params so the customer page rehydrates the same order/session
   * (selected payment method, shipping, etc.). Only strips truly transient flags.
   */
  const detailsHref = useMemo(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("success");
    p.delete("canceled");
    const q = p.toString();
    return `/order/customer${q ? `?${q}` : ""}`;
  }, [searchParams]);

  const onBackToDetails = useCallback(() => {
    // Pure router navigation: do not clear any client state.
    router.push(detailsHref);
  }, [router, detailsHref]);

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

  const backClassName =
    "text-sm font-medium text-[#2563EB] underline-offset-4 hover:underline";

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 bg-[#FAFAFA] px-4 py-10">
      <h1 className="text-2xl font-semibold text-[#111111]">Payment</h1>
      <p className="text-sm text-[#6B7280]">
        Pay securely with card. Your order is already created; completing checkout
        charges this order only.
      </p>
      {orderId ? (
        <p className="rounded-lg border border-gray-200 bg-white px-4 py-3 font-mono text-xs text-[#111111] break-all">
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
        className="w-full rounded-2xl bg-[#2563EB] py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "Starting checkout…" : "Pay now"}
      </button>
      <button
        type="button"
        className={`inline border-0 bg-transparent p-0 text-left ${backClassName}`}
        onClick={onBackToDetails}
      >
        Back to order details
      </button>
    </div>
  );
}

export default function OrderPaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-10 text-sm text-[#6B7280]">
          Loading…
        </div>
      }
    >
      <OrderPaymentInner />
    </Suspense>
  );
}
