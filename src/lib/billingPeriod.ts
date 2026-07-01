/** Usage windows longer than this are treated as corrupted (e.g. yearly Clerk subscription period). */
export const MAX_USAGE_PERIOD_MS = 35 * 24 * 60 * 60 * 1000;

/** Next monthly billing boundary from `from` (default: now + 1 calendar month). */
export function defaultBillingPeriodEnd(from: Date = new Date()): Date {
  const end = new Date(from);
  end.setMonth(end.getMonth() + 1);
  return end;
}

export function isCorruptedUsagePeriod(
  periodStart: Date,
  periodEnd: Date,
): boolean {
  if (
    !Number.isFinite(periodStart.getTime()) ||
    !Number.isFinite(periodEnd.getTime())
  ) {
    return false;
  }
  return periodEnd.getTime() - periodStart.getTime() > MAX_USAGE_PERIOD_MS;
}

/** Advance stored billing period forward until `now` is strictly before period end. */
export function advanceBillingPeriodToContain(
  periodStart: Date,
  periodEnd: Date,
  now: Date,
): { currentPeriodStart: Date; currentPeriodEnd: Date } {
  let start = new Date(periodStart);
  let end = new Date(periodEnd);

  for (let i = 0; i < 120 && end <= now; i++) {
    start = new Date(end);
    end = defaultBillingPeriodEnd(start);
  }

  return { currentPeriodStart: start, currentPeriodEnd: end };
}

/**
 * Resolve the current monthly usage window. When the stored end spans longer
 * than one month (legacy Clerk annual sync), recompute from the start anchor.
 */
export function resolveUsagePeriodWindow(
  periodStart: Date,
  periodEnd: Date,
  now: Date,
): { currentPeriodStart: Date; currentPeriodEnd: Date } {
  const start = new Date(periodStart);
  const end = isCorruptedUsagePeriod(start, periodEnd)
    ? defaultBillingPeriodEnd(start)
    : new Date(periodEnd);

  return advanceBillingPeriodToContain(start, end, now);
}
