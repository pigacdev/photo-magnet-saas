"use client";

import type { OrderContentWidth } from "./orderUi";
import { orderContentWidthClass } from "./orderUi";
import { EventEntryBanner } from "./EventEntryBanner";
import { useOrderFlowBanner } from "./OrderFlowBannerContext";

export type OrderShellProps = {
  children: React.ReactNode;
  bottomBar?: React.ReactNode;
  contentWidth?: OrderContentWidth;
  className?: string;
  /** Static banner (e.g. event entry page). Overrides flow banner when set. */
  bannerUrl?: string | null;
  /** When true (default), show event banner from order session inside this shell. */
  showFlowBanner?: boolean;
};

export function OrderShell({
  children,
  bottomBar,
  contentWidth = "medium",
  className = "",
  bannerUrl: bannerUrlProp,
  showFlowBanner = true,
}: OrderShellProps) {
  const flowBannerUrl = useOrderFlowBanner();
  const bannerUrl =
    bannerUrlProp ?? (showFlowBanner ? flowBannerUrl : null);

  return (
    <div
      className={`flex min-h-screen flex-col bg-surface ${bottomBar ? "pb-36" : ""} ${className}`}
    >
      {bannerUrl ? (
        <div className={`mx-auto w-full ${orderContentWidthClass(contentWidth)}`}>
          <EventEntryBanner bannerUrl={bannerUrl} className="mb-6" />
        </div>
      ) : null}
      <div
        className={`mx-auto flex w-full flex-1 flex-col px-4 ${bannerUrl ? "" : "pt-8"} ${orderContentWidthClass(contentWidth)}`}
      >
        {children}
      </div>
      {bottomBar}
    </div>
  );
}
