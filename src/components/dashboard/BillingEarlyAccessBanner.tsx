"use client";

import Link from "next/link";
import type { EarlyAccessStatus } from "@/lib/earlyAccessUi";

type Props = {
  status: EarlyAccessStatus;
};

export function BillingEarlyAccessBanner({ status }: Props) {
  if (!status.isOpen || status.userIsEarlyAccess) return null;

  return (
    <div
      className="early-access-banner mb-4 overflow-hidden rounded-lg border border-amber-300/60 bg-gradient-to-r from-amber-50 via-orange-50 to-primary/5 px-4 py-4 shadow-sm dark:border-amber-600/40 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-primary/10"
      role="status"
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-200/70 text-amber-950 dark:bg-amber-800/50 dark:text-amber-100"
          title="Information"
        >
          <svg
            className="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" d="M12 16v-4" />
            <circle cx="12" cy="8" r="0.5" fill="currentColor" stroke="none" />
          </svg>
          <span className="sr-only">Information</span>
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            Early access — limited launch pricing
          </p>
          <p className="mt-0.5 text-sm text-amber-900/90 dark:text-amber-200/90">
            60-day free trial on Hobby &amp; Pro · card required ·{" "}
            <span className="font-bold tabular-nums underline decoration-amber-700/60 underline-offset-2 dark:decoration-amber-300/50">
              {status.seatsRemaining}{" "}
              {status.seatsRemaining === 1 ? "seat" : "seats"} remaining
            </span>
          </p>
        </div>

        <Link
          href="/dashboard/billing"
          className="inline-flex shrink-0 items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:px-4"
        >
          View plans &amp; start trial
        </Link>
      </div>
    </div>
  );
}
