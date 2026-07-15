"use client";

import type { EarlyAccessStatus } from "@/lib/earlyAccessUi";
import { EARLY_ACCESS_MEMBER_BODY } from "@/lib/earlyAccessCopy";
import { EarlyAccessFeedbackLinks } from "@/components/dashboard/EarlyAccessFeedbackLinks";

type Props = {
  status: EarlyAccessStatus;
  /** When false, banner is hidden (e.g. trial ended but flag not yet cleared). */
  show?: boolean;
};

export function BillingEarlyAccessMemberBanner({ status, show = true }: Props) {
  if (!status.userIsEarlyAccess || !show) return null;

  return (
    <div
      className="mb-4 overflow-hidden rounded-lg border border-amber-200/70 bg-gradient-to-r from-amber-50/80 via-orange-50/50 to-primary/5 px-4 py-4 shadow-sm dark:border-amber-700/30 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-primary/5"
      role="status"
    >
      <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
        Early access member
      </p>
      <p className="mt-1.5 text-sm text-amber-900/90 dark:text-amber-200/90">
        {EARLY_ACCESS_MEMBER_BODY}
      </p>
      <div className="mt-1.5">
        <EarlyAccessFeedbackLinks />
      </div>
    </div>
  );
}
