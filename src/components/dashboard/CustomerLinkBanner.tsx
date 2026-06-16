"use client";

import Link from "next/link";
import { useCopyLink } from "@/hooks/useCopyLink";

export type CustomerLinkBannerProps = {
  publicUrl: string;
  variant: "event" | "storefront";
  monthlyLimitReached?: boolean;
  className?: string;
};

export function CustomerLinkBanner({
  publicUrl,
  variant,
  monthlyLimitReached = false,
  className = "mt-4",
}: CustomerLinkBannerProps) {
  const { copy, copied, canCopy } = useCopyLink(publicUrl);

  if (!canCopy) return null;

  const ariaLabel =
    variant === "event"
      ? "Copy customer event order link"
      : "Copy customer storefront order link";

  return (
    <div
      className={`w-fit max-w-full rounded-xl border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-950/20 ${className}`}
      role="region"
      aria-label="Customer order link"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div>
          <p className="text-sm font-semibold text-green-800 dark:text-green-300">
            Customer order link
          </p>
          <p className="mt-0.5 text-sm text-green-800/90 dark:text-green-300/90">
            Share this link or QR code with customers.
          </p>
        </div>
        {monthlyLimitReached ? (
          <div className="shrink-0 space-y-1 text-sm">
            <p className="font-semibold text-red-800 dark:text-red-400">
              Monthly usage has been reached
            </p>
            <Link
              href="/dashboard/billing"
              className="font-medium text-primary underline"
            >
              View plans
            </Link>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void copy()}
            aria-label={ariaLabel}
            className="shrink-0 min-h-[44px] rounded-lg bg-[#16A34A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        )}
      </div>
    </div>
  );
}
