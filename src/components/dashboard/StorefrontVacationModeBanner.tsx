"use client";

import Link from "next/link";
import type { DateFormat } from "@/lib/dateFormat";
import { formatDisplayDate } from "@/lib/dateFormat";

export type StorefrontVacationModeBannerProps = {
  canUseVacationMode: boolean;
  vacationScheduled: boolean;
  isVacationMode: boolean;
  vacationFrom: string | null;
  vacationTo: string | null;
  vacationNote: string | null;
  dateFormat?: DateFormat;
  onEnableClick: () => void;
  onDisableClick: () => void;
  className?: string;
};

export function StorefrontVacationModeBanner({
  canUseVacationMode,
  vacationScheduled,
  isVacationMode,
  vacationFrom,
  vacationTo,
  vacationNote,
  dateFormat,
  onEnableClick,
  onDisableClick,
  className = "",
}: StorefrontVacationModeBannerProps) {
  const fromLabel =
    vacationFrom != null ? formatDisplayDate(vacationFrom, dateFormat) : null;
  const toLabel =
    vacationTo != null ? formatDisplayDate(vacationTo, dateFormat) : null;

  return (
    <div
      className={`w-full max-w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/20 ${className}`}
      role="region"
      aria-label="Vacation mode"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            Vacation mode
          </p>
          {!canUseVacationMode ? (
            <p className="mt-0.5 text-sm text-amber-900/90 dark:text-amber-200/90">
              The Free plan keeps your storefront always open.{" "}
              <Link href="/dashboard/billing" className="font-medium text-primary underline">
                Upgrade to Hobby
              </Link>{" "}
              to pause orders while you are away.
            </p>
          ) : vacationScheduled && fromLabel && toLabel ? (
            <>
              <p className="mt-0.5 text-sm text-amber-900/90 dark:text-amber-200/90">
                {isVacationMode
                  ? "Your storefront is on vacation and cannot receive new orders."
                  : "Vacation is scheduled. Orders will pause automatically during these dates."}
              </p>
              <p className="mt-2 text-sm font-medium text-amber-950 dark:text-amber-100">
                {fromLabel} — {toLabel}
              </p>
              {vacationNote ? (
                <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-200/90">
                  {vacationNote}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-0.5 text-sm text-amber-900/90 dark:text-amber-200/90">
              Pause new orders for a date range. Customers will see your vacation
              message on the storefront page.
            </p>
          )}
        </div>
        {canUseVacationMode ? (
          vacationScheduled ? (
            <button
              type="button"
              onClick={onDisableClick}
              className="shrink-0 min-h-[44px] rounded-lg border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-card dark:text-amber-100 dark:hover:bg-amber-950/40"
            >
              Disable vacation mode
            </button>
          ) : (
            <button
              type="button"
              onClick={onEnableClick}
              className="shrink-0 min-h-[44px] rounded-lg bg-[#F59E0B] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#D97706]"
            >
              Enable vacation mode
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}
