"use client";

import type { EarlyAccessStatus } from "@/lib/earlyAccessUi";
import {
  EarlyAccessProspectCard,
  EarlyAccessProspectContent,
} from "@/components/dashboard/EarlyAccessProspectContent";

type Props = {
  status: EarlyAccessStatus;
};

export function BillingEarlyAccessProspectCallout({ status }: Props) {
  if (!status.isOpen || status.userIsEarlyAccess) return null;

  return (
    <EarlyAccessProspectCard className="mb-6">
      <EarlyAccessProspectContent status={status} />
    </EarlyAccessProspectCard>
  );
}
