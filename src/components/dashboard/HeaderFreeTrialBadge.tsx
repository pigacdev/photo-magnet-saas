"use client";

import Link from "next/link";

type Props = {
  daysRemaining: number;
};

function trialCopy(daysRemaining: number): { primary: string; secondary: string } {
  if (daysRemaining <= 0) {
    return { primary: "Ends today", secondary: "Free trial" };
  }
  if (daysRemaining === 1) {
    return { primary: "1 day left", secondary: "on trial" };
  }
  return {
    primary: `${daysRemaining} days left`,
    secondary: "on trial",
  };
}

export function HeaderFreeTrialBadge({ daysRemaining }: Props) {
  const { primary, secondary } = trialCopy(daysRemaining);

  return (
    <Link
      href="/dashboard/billing"
      title={`${primary} ${secondary}`}
      className="group inline-flex max-w-[11rem] items-center gap-2 rounded-full border border-amber-200/80 bg-gradient-to-r from-amber-50 via-orange-50/80 to-amber-50/60 py-1 pl-1.5 pr-3 shadow-sm ring-1 ring-amber-100/60 transition-all hover:border-amber-300 hover:shadow-md hover:ring-amber-200/80 dark:border-amber-600/40 dark:bg-gradient-to-br dark:from-amber-950/70 dark:via-amber-900/35 dark:to-amber-950/80 dark:shadow-[inset_0_1px_0_0_rgba(251,191,36,0.1)] dark:ring-amber-800/50 dark:hover:border-amber-500/50 dark:hover:from-amber-950/80 dark:hover:via-amber-900/45 dark:hover:to-amber-950/90 sm:max-w-none"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-200/75 text-amber-900 shadow-inner transition-colors group-hover:bg-amber-300/80 dark:bg-amber-500/20 dark:text-amber-300 dark:shadow-[0_0_10px_rgba(245,158,11,0.12)] dark:ring-1 dark:ring-amber-500/25 dark:group-hover:bg-amber-500/30">
        <svg
          className="size-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" d="M12 7v5l3 2" />
        </svg>
      </span>
      <span className="min-w-0 leading-none">
        <span className="block truncate text-xs font-semibold tabular-nums tracking-tight text-amber-950 dark:text-amber-50">
          {primary}
        </span>
        <span className="mt-0.5 block truncate text-[10px] font-medium text-amber-800/75 dark:text-amber-400/90">
          {secondary}
        </span>
      </span>
    </Link>
  );
}
