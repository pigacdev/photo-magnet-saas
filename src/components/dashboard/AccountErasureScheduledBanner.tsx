"use client";

import Link from "next/link";
import { getCachedUser } from "@/lib/auth";

function AccountErasureAlertIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" d="M12 8v4" />
      <circle cx="12" cy="16" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function AccountErasureScheduledBanner() {
  const erasureScheduledAt = getCachedUser()?.erasureScheduledAt ?? null;

  if (!erasureScheduledAt) return null;

  return (
    <div
      className="mb-4 rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 via-amber-50/50 to-background px-4 py-4 shadow-sm dark:border-amber-800/40 dark:from-amber-950/40 dark:via-amber-950/20 dark:to-card sm:px-5 sm:py-5"
      role="alert"
    >
      <div className="flex min-w-0 gap-3">
        <span
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-200/70 text-amber-950 dark:bg-amber-800/50 dark:text-amber-100"
          aria-hidden
        >
          <AccountErasureAlertIcon />
        </span>

        <div className="min-w-0 flex-1 text-sm leading-relaxed text-amber-950 dark:text-amber-100">
          <p>
            Account deletion is scheduled for{" "}
            <span className="font-medium tabular-nums">
              {new Date(erasureScheduledAt).toLocaleString()}
            </span>
            . You can cancel until then.
          </p>
          <Link
            href="/dashboard/settings"
            className="mt-2 inline-block font-medium text-primary underline-offset-2 hover:underline"
          >
            Go to Settings to cancel deletion
          </Link>
        </div>
      </div>
    </div>
  );
}
