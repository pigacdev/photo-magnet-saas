"use client";

import Link from "next/link";
import type { EarlyAccessStatus } from "@/lib/earlyAccessUi";
import {
  EarlyAccessProspectCard,
  EarlyAccessProspectContent,
} from "@/components/dashboard/EarlyAccessProspectContent";

type Props = {
  status: EarlyAccessStatus;
};

export function BillingEarlyAccessBanner({ status }: Props) {
  if (!status.isOpen || status.userIsEarlyAccess) return null;

  return (
    <EarlyAccessProspectCard className="mb-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <EarlyAccessProspectContent status={status} />
        <Link
          href="/dashboard/billing"
          className="inline-flex w-full shrink-0 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto"
        >
          View plans &amp; start trial
        </Link>
      </div>
    </EarlyAccessProspectCard>
  );
}
