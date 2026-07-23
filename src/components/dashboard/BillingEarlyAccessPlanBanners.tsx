"use client";

import type { EarlyAccessStatus } from "@/lib/earlyAccessUi";

const EARLY_ACCESS_PLAN_BANNER_SUBTEXT =
  "60-day trial · tester feedback welcome";

function bannerSubtext(status: EarlyAccessStatus): string {
  const seats =
    status.seatsRemaining === 1
      ? "Only 1 spot left"
      : `${status.seatsRemaining} spots left`;
  return `${seats} · ${EARLY_ACCESS_PLAN_BANNER_SUBTEXT}`;
}

export function BillingEarlyAccessPlanBanners({
  status,
}: {
  status: EarlyAccessStatus | null;
}) {
  if (!status?.isOpen) return null;

  return (
    <div
      className="billing-early-access-banner-grid"
      aria-hidden="true"
    >
      <div className="billing-early-access-banner-spacer" />
      <div className="billing-early-access-plan-banner">
        <div className="billing-early-access-plan-banner-top">
          <span className="billing-early-access-plan-corner">Launch offer</span>
        </div>
        <span className="billing-early-access-plan-banner-title">
          Early access — limited spots
        </span>
        <span className="billing-early-access-plan-banner-sub">
          {bannerSubtext(status)}
        </span>
      </div>
      <div className="billing-early-access-plan-banner billing-early-access-plan-banner--pro">
        <div className="billing-early-access-plan-banner-top">
          <span className="billing-early-access-plan-corner billing-early-access-plan-corner--pro">
            Best launch offer
          </span>
        </div>
        <span className="billing-early-access-plan-banner-title">
          Early access — limited spots
        </span>
        <span className="billing-early-access-plan-banner-sub">
          {bannerSubtext(status)}
        </span>
      </div>
    </div>
  );
}
