"use client";

import type { EarlyAccessStatus } from "@/lib/earlyAccessUi";
import {
  EARLY_ACCESS_EXPECTATION,
  EARLY_ACCESS_HEADLINE,
  EARLY_ACCESS_PROSPECT_BODY,
} from "@/lib/earlyAccessCopy";
import { EarlyAccessFeedbackLinks } from "@/components/dashboard/EarlyAccessFeedbackLinks";

type Props = {
  status: EarlyAccessStatus;
};

export function BillingEarlyAccessProspectCallout({ status }: Props) {
  if (!status.isOpen || status.userIsEarlyAccess) return null;

  return (
    <div
      className="mb-6 overflow-hidden rounded-lg border border-amber-300/60 bg-gradient-to-r from-amber-50 via-orange-50 to-primary/5 px-4 py-4 shadow-sm dark:border-amber-600/40 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-primary/10"
      role="status"
    >
      <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
        {EARLY_ACCESS_HEADLINE}
      </p>
      <p className="mt-1.5 text-sm text-amber-900/90 dark:text-amber-200/90">
        {EARLY_ACCESS_PROSPECT_BODY} ·{" "}
        <span className="font-bold tabular-nums underline decoration-amber-700/60 underline-offset-2 dark:decoration-amber-300/50">
          {status.seatsRemaining}{" "}
          {status.seatsRemaining === 1 ? "seat" : "seats"} remaining
        </span>
      </p>
      <p className="mt-1.5 text-sm text-amber-900/90 dark:text-amber-200/90">
        {EARLY_ACCESS_EXPECTATION}
      </p>
      <div className="mt-1.5">
        <EarlyAccessFeedbackLinks />
      </div>
    </div>
  );
}
