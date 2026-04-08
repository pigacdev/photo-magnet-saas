"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Phase 5G — Payment integration lands here.
 * Review flow navigates here after “Proceed to payment”.
 */
export default function OrderPaymentPage() {
  const [backHref, setBackHref] = useState("/order/review");

  useEffect(() => {
    const q = window.location.search;
    setBackHref(`/order/review${q}`);
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 bg-[#FAFAFA] px-4 py-10">
      <h1 className="text-2xl font-semibold text-[#111111]">Payment</h1>
      <p className="text-sm text-[#6B7280]">
        Secure checkout will be connected in a later phase. Your crop and
        pricing selections are stored on the session until then.
      </p>
      <Link
        href={backHref}
        className="text-sm font-medium text-[#2563EB] underline-offset-4 hover:underline"
      >
        Back to review
      </Link>
    </div>
  );
}
