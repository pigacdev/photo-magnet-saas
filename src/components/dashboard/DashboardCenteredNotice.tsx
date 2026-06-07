"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type DashboardCenteredNoticeProps = {
  title: string;
  description?: string;
  variant?: "neutral" | "limit";
  limitReached?: boolean;
  children?: ReactNode;
  fillHeight?: boolean;
};

export function DashboardCenteredNotice({
  title,
  description,
  variant = "neutral",
  limitReached = true,
  children,
  fillHeight = true,
}: DashboardCenteredNoticeProps) {
  const content = (
    <>
      <h2 className="text-lg font-medium text-foreground">{title}</h2>
      {description ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {children ? <div className="mt-4 space-y-3">{children}</div> : null}
    </>
  );

  const wrapperClass = fillHeight
    ? "flex min-h-[50vh] flex-col items-center justify-center px-4 text-center"
    : "flex flex-col items-center px-4 py-8 text-center";

  if (variant === "limit") {
    const panelClass = limitReached
      ? "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30"
      : "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30";
    const titleClass = limitReached
      ? "text-red-900 dark:text-red-200"
      : "text-amber-950 dark:text-amber-100";
    const descriptionClass = limitReached
      ? "text-red-800 dark:text-red-300"
      : "text-amber-950 dark:text-amber-200";

    return (
      <div className={wrapperClass} role="status">
        <div
          className={`w-full max-w-md rounded-lg border px-6 py-8 ${panelClass}`}
        >
          <h2 className={`text-lg font-medium ${titleClass}`}>{title}</h2>
          {description ? (
            <p className={`mt-2 text-sm leading-relaxed ${descriptionClass}`}>
              {description}
            </p>
          ) : null}
          {children ? <div className="mt-4 space-y-3">{children}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <div className="w-full max-w-md">{content}</div>
    </div>
  );
}

type EventLimitReachedNoticeProps = {
  eventsCreated: number;
  eventLimit: number;
  fillHeight?: boolean;
  showBackLink?: boolean;
};

export function EventLimitReachedNotice({
  eventsCreated,
  eventLimit,
  fillHeight = true,
  showBackLink = false,
}: EventLimitReachedNoticeProps) {
  const linkClass =
    "inline-block text-sm font-medium text-primary hover:underline";

  return (
    <DashboardCenteredNotice
      variant="limit"
      limitReached
      fillHeight={fillHeight}
      title="Monthly event limit reached"
      description={`You've reached your monthly event limit (${eventsCreated} / ${eventLimit}). Upgrade your plan to create more events, or wait until your usage resets.`}
    >
      <Link href="/dashboard/billing" className={linkClass}>
        View plans &amp; upgrade
      </Link>
      {showBackLink ? (
        <Link href="/dashboard/events" className={linkClass}>
          Back to events
        </Link>
      ) : null}
    </DashboardCenteredNotice>
  );
}
