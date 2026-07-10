/** Max sellers who receive the 60-day early-access window. */
export const EARLY_ACCESS_SEAT_LIMIT = 20;

/** Length of early-access trial in days (matches Clerk free_trial_days). */
export const EARLY_ACCESS_DURATION_DAYS = 60;

/** Days before trial expiry to send the heads-up email. */
export const EARLY_ACCESS_HEADS_UP_DAYS = 7;

/** Days before trial end to transition loyalty pricing (before Clerk's first charge). */
export const EARLY_ACCESS_LOYALTY_TRANSITION_DAYS = 2;

/** Paid plan slugs eligible for early-access free trials. */
export const EARLY_ACCESS_ELIGIBLE_PLAN_SLUGS = ["hobby", "pro"] as const;

export type EarlyAccessEligiblePlanSlug =
  (typeof EARLY_ACCESS_ELIGIBLE_PLAN_SLUGS)[number];

export function isEarlyAccessEligiblePlanSlug(
  slug: string | null | undefined,
): slug is EarlyAccessEligiblePlanSlug {
  if (!slug) return false;
  const normalized = slug.toLowerCase();
  return normalized === "hobby" || normalized === "pro";
}

export type TrialItemLike = {
  status?: string;
  is_free_trial?: boolean;
};

export function isTrialSubscriptionItem(item: TrialItemLike | undefined): boolean {
  if (!item) return false;
  if (item.is_free_trial === true) return true;
  const status = item.status?.toLowerCase();
  return status === "free_trial" || status === "trialing";
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function earlyAccessExpiresAt(from: Date = new Date()): Date {
  return addDays(from, EARLY_ACCESS_DURATION_DAYS);
}

export function seatsRemaining(seatsTaken: number): number {
  return Math.max(0, EARLY_ACCESS_SEAT_LIMIT - seatsTaken);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days until `endsAt` (ceil partial days); 0 on the last calendar day. */
export function freeTrialDaysRemaining(
  endsAt: string | Date,
  now: Date = new Date(),
): number {
  const end = typeof endsAt === "string" ? new Date(endsAt) : endsAt;
  if (Number.isNaN(end.getTime()) || end <= now) return 0;
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / MS_PER_DAY));
}

export function formatFreeTrialDaysLabel(daysRemaining: number): string {
  if (daysRemaining <= 0) return "Trial ends today";
  if (daysRemaining === 1) return "1 day left on trial";
  return `${daysRemaining} days left on trial`;
}

export function isEarlyAccessOpen(
  seatsTaken: number,
  plansFlippedAt: Date | null | undefined,
): boolean {
  if (plansFlippedAt) return false;
  return seatsTaken < EARLY_ACCESS_SEAT_LIMIT;
}
