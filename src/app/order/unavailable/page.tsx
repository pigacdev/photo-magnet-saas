"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { getSafeOrderReturnTo } from "@/lib/orderReturnTo";
import { OrderShell } from "@/components/order/OrderShell";
import { OrderStepHeader } from "@/components/order/OrderStepHeader";
import { orderLoadingScreen } from "@/components/order/orderUi";

type ContextKind = "event" | "storefront";

function resolveContextFromSearchParams(searchParams: URLSearchParams): {
  kind: ContextKind;
  slug: string;
} | null {
  const eventSlug = searchParams.get("eventSlug")?.trim();
  if (eventSlug) return { kind: "event", slug: eventSlug };

  const storefrontSlug = searchParams.get("storefrontSlug")?.trim();
  if (storefrontSlug) return { kind: "storefront", slug: storefrontSlug };

  const rawReturn = searchParams.get("returnTo");
  const safe = rawReturn ? getSafeOrderReturnTo(rawReturn) : null;
  if (!safe) return null;

  if (safe.startsWith("/event/")) {
    const slug = safe.slice("/event/".length).trim();
    if (slug) return { kind: "event", slug };
  }
  if (safe.startsWith("/store/")) {
    const slug = safe.slice("/store/".length).trim();
    if (slug) return { kind: "storefront", slug };
  }

  return null;
}

function OrderUnavailableInner() {
  const searchParams = useSearchParams();
  const [nameByContextKey, setNameByContextKey] = useState<
    Record<string, string>
  >({});

  const context = useMemo(
    () => resolveContextFromSearchParams(searchParams),
    [searchParams],
  );

  const contextKey = context
    ? `${context.kind}:${context.slug}`
    : null;

  useEffect(() => {
    if (!context || !contextKey) return;

    const path =
      context.kind === "event"
        ? `/api/public/entry/event/${encodeURIComponent(context.slug)}`
        : `/api/public/entry/storefront/${encodeURIComponent(context.slug)}`;

    let cancelled = false;
    void api<{ name: string }>(path)
      .then((d) => {
        const n = d.name?.trim();
        if (cancelled || !n) return;
        setNameByContextKey((prev) => ({ ...prev, [contextKey]: n }));
      })
      .catch(() => {
        /* keep generic heading */
      });

    return () => {
      cancelled = true;
    };
  }, [context, contextKey]);

  const displayName =
    contextKey != null ? nameByContextKey[contextKey] : undefined;

  const personalizedLine = useMemo(() => {
    if (!displayName) return null;
    if (context?.kind === "event") {
      return `This event (${displayName}) is temporarily unavailable`;
    }
    return `This store (${displayName}) is temporarily unavailable`;
  }, [displayName, context?.kind]);

  return (
    <OrderShell contentWidth="medium" className="justify-center pb-10">
      <div className="w-full space-y-4 text-center">
        <OrderStepHeader
          title={
            personalizedLine ?? "Store temporarily unavailable"
          }
          subtitle="This store has reached its monthly order limit. Please try again later."
        />

        <Link
          href="/"
          className="inline-block text-sm text-[#2563EB] underline"
        >
          Start a new order
        </Link>
      </div>
    </OrderShell>
  );
}

export default function OrderUnavailablePage() {
  return (
    <Suspense
      fallback={
        <div className={orderLoadingScreen}>
          <p className="text-sm text-[#6B7280]">Loading…</p>
        </div>
      }
    >
      <OrderUnavailableInner />
    </Suspense>
  );
}
