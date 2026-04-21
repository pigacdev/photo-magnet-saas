"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { clearEventCheckoutCopies } from "@/lib/eventCheckoutSessionBridge";
import { getSafeOrderReturnTo } from "@/lib/orderReturnTo";
import type { GetSessionResponse } from "@/lib/orderSessionTypes";

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

  /** Event checkout: drop persisted copy counts only after this final step. */
  useEffect(() => {
    void api<GetSessionResponse>("/api/session").then((d) => {
      if (d.session?.contextType === "event") {
        clearEventCheckoutCopies(d.session.id);
      }
    });
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 bg-[#FAFAFA] px-4 py-10">
      <h1 className="text-2xl font-semibold text-[#111111]">Order received</h1>
      <p className="text-sm text-[#6B7280]">
        Thank you. Your magnets are reserved. Complete payment at the event
        using the method you chose (cash or card on location, as offered by the
        organizer).
      </p>
      <Link
        href={continueHref}
        className="text-sm font-medium text-[#2563EB] underline-offset-4 hover:underline"
      >
        Continue
      </Link>
    </div>
  );
}
