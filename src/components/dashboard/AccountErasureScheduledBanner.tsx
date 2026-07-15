"use client";

import Link from "next/link";
import { getCachedUser } from "@/lib/auth";

export function AccountErasureScheduledBanner() {
  const erasureScheduledAt = getCachedUser()?.erasureScheduledAt ?? null;

  if (!erasureScheduledAt) return null;

  return (
    <div
      className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
      role="alert"
    >
      <p>
        Account deletion is scheduled for{" "}
        <span className="font-medium tabular-nums">
          {new Date(erasureScheduledAt).toLocaleString()}
        </span>
        . You can cancel until then.
      </p>
      <Link
        href="/dashboard/settings"
        className="mt-2 inline-block font-medium text-primary underline"
      >
        Go to Settings to cancel deletion
      </Link>
    </div>
  );
}
