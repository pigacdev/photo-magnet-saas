"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { GetOrderStatusResponse } from "@/lib/orderSessionTypes";

const POLL_MS = 1500;
const MAX_POLL_MS = 90_000;

type UiPhase =
  | "idle"
  | "processing"
  | "paid"
  | "timeout"
  | "error"
  | "no_order_id"
  | "unexpected_status";

/**
 * After Stripe redirects here, the webhook may lag. Poll until DB shows PAID.
 */
function OrderSuccessInner() {
  const searchParams = useSearchParams();
  const orderId = useMemo(
    () => searchParams.get("orderId")?.trim() ?? "",
    [searchParams],
  );

  const [phase, setPhase] = useState<UiPhase>("idle");
  const [unexpectedStatus, setUnexpectedStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setPhase("no_order_id");
      return;
    }

    let alive = true;
    const started = Date.now();

    const run = async () => {
      setPhase("processing");

      while (alive && Date.now() - started < MAX_POLL_MS) {
        try {
          const data = await api<GetOrderStatusResponse>(
            `/api/orders/${encodeURIComponent(orderId)}`,
          );
          if (!alive) return;

          if (data.status === "PAID") {
            setPhase("paid");
            return;
          }

          if (data.status !== "PENDING_PAYMENT") {
            setUnexpectedStatus(data.status);
            setPhase("unexpected_status");
            return;
          }

          await new Promise((r) => setTimeout(r, POLL_MS));
        } catch {
          if (alive) setPhase("error");
          return;
        }
      }

      if (alive) setPhase("timeout");
    };

    void run();
    return () => {
      alive = false;
    };
  }, [orderId]);

  const title =
    phase === "paid"
      ? "Payment successful"
      : phase === "timeout" || phase === "error"
        ? "Confirming payment"
        : phase === "unexpected_status"
          ? "Order status"
          : "Processing payment…";

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 bg-[#FAFAFA] px-4 py-10">
      <h1 className="text-2xl font-semibold text-[#111111]">{title}</h1>

      {orderId && (phase === "idle" || phase === "processing") && (
        <p className="text-sm text-[#6B7280]">
          Processing payment… This usually takes a few seconds.
        </p>
      )}

      {phase === "paid" && (
        <>
          <p className="text-sm text-[#6B7280]">
            Your payment is confirmed. You can keep this order reference:
          </p>
          <Link
            href={`/order/customer?orderId=${encodeURIComponent(orderId)}&from=success`}
            className="inline-flex min-h-[44px] items-center text-sm font-medium text-[#2563EB] underline-offset-4 hover:underline"
          >
            Edit customer info
          </Link>
        </>
      )}

      {(phase === "timeout" || phase === "error") && (
        <p className="text-sm text-[#6B7280]">
          {phase === "timeout"
            ? "Confirmation is taking longer than usual. Your payment may still complete — check your order later or contact support with the order id below."
            : "Could not load order status. Your payment may still be processing."}
        </p>
      )}

      {phase === "unexpected_status" && unexpectedStatus && (
        <p className="text-sm text-[#6B7280]">
          Current status: <span className="font-mono">{unexpectedStatus}</span>
        </p>
      )}

      {phase === "no_order_id" && (
        <p className="text-sm text-amber-800">No order id in the link.</p>
      )}

      {orderId ? (
        <p className="rounded-lg border border-gray-200 bg-white px-4 py-3 font-mono text-sm text-[#111111] break-all">
          {orderId}
        </p>
      ) : null}

      <Link
        href="/"
        className="text-sm font-medium text-[#2563EB] underline-offset-4 hover:underline"
      >
        Home
      </Link>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-10 text-sm text-[#6B7280]">
          Loading…
        </div>
      }
    >
      <OrderSuccessInner />
    </Suspense>
  );
}
