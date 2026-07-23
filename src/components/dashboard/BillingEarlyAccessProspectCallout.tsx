"use client";

import type { EarlyAccessStatus } from "@/lib/earlyAccessUi";
import {
  EARLY_ACCESS_EXPECTATION,
  EARLY_ACCESS_HEADLINE,
  EARLY_ACCESS_LAUNCH_PILL,
  EARLY_ACCESS_OFFER_SCOPE,
  EARLY_ACCESS_PROSPECT_BODY,
} from "@/lib/earlyAccessCopy";
import { EarlyAccessFeedbackLinks } from "@/components/dashboard/EarlyAccessFeedbackLinks";

type Props = {
  status: EarlyAccessStatus;
};

export function BillingEarlyAccessProspectCallout({ status }: Props) {
  if (!status.isOpen || status.userIsEarlyAccess) return null;

  const spotsLabel =
    status.seatsRemaining === 1 ? "spot left" : "spots left";

  return (
    <div className="billing-early-access-offer-box mb-6" role="status">
      <div className="billing-early-access-offer-box-top">
        <span className="billing-early-access-offer-pill">
          {EARLY_ACCESS_LAUNCH_PILL}
        </span>
      </div>
      <p className="billing-early-access-offer-headline">
        {EARLY_ACCESS_HEADLINE}
      </p>
      <p className="billing-early-access-offer-seats">
        <span className="billing-early-access-offer-seats-count tabular-nums">
          {status.seatsRemaining}
        </span>{" "}
        <span className="billing-early-access-offer-seats-label">
          {spotsLabel}
        </span>
      </p>
      <p className="billing-early-access-offer-scope">
        {EARLY_ACCESS_OFFER_SCOPE}
      </p>
      <p className="billing-early-access-offer-body">
        {EARLY_ACCESS_PROSPECT_BODY}
      </p>
      <p className="billing-early-access-offer-body">
        {EARLY_ACCESS_EXPECTATION}
      </p>
      <div className="billing-early-access-offer-links">
        <EarlyAccessFeedbackLinks tone="onBrand" />
      </div>
    </div>
  );
}
