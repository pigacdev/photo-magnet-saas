import { isFreeClerkPlanSlug } from "./planCatalog";

export type ClerkBillingPeriodItem = {
  plan?: { slug?: string };
  status?: string;
  period_start?: number | string;
  period_end?: number | string | null;
  current_period_start?: number | string;
  current_period_end?: number | string | null;
};

export type ClerkBillingPeriodSource = {
  plan?: { slug?: string };
  status?: string;
  period_start?: number | string;
  period_end?: number | string | null;
  current_period_start?: number | string;
  current_period_end?: number | string | null;
  items?: ClerkBillingPeriodItem[];
  subscription_items?: ClerkBillingPeriodItem[];
};

export type ClerkBillingPeriod = {
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
};

/** Clerk billing item statuses that still grant plan entitlements. */
export function isActiveBillingItemStatus(status: string | undefined): boolean {
  const normalized = status?.toLowerCase();
  if (!normalized) return true;
  return (
    normalized === "active" ||
    normalized === "upcoming" ||
    normalized === "past_due" ||
    normalized === "trialing" ||
    normalized === "free_trial"
  );
}

function parseUnixTimestamp(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim()) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return asNumber;
    const asDate = Date.parse(value);
    if (Number.isFinite(asDate)) return Math.floor(asDate / 1000);
  }
  return null;
}

function unixToDate(unix: number): Date | null {
  const ms = unix > 1e12 ? unix : unix * 1000;
  const date = new Date(ms);
  return Number.isFinite(date.getTime()) ? date : null;
}

function periodFromTimestamps(
  startValue: number | string | null | undefined,
  endValue: number | string | null | undefined,
): ClerkBillingPeriod | null {
  const startSec = parseUnixTimestamp(startValue);
  const endSec = parseUnixTimestamp(endValue);
  if (startSec == null || endSec == null) return null;

  const currentPeriodStart = unixToDate(startSec);
  const currentPeriodEnd = unixToDate(endSec);
  if (!currentPeriodStart || !currentPeriodEnd) return null;
  if (currentPeriodEnd.getTime() <= currentPeriodStart.getTime()) return null;

  return { currentPeriodStart, currentPeriodEnd };
}

function periodFromItem(item: ClerkBillingPeriodItem): ClerkBillingPeriod | null {
  const fromClerk = periodFromTimestamps(item.period_start, item.period_end);
  if (fromClerk) return fromClerk;

  return periodFromTimestamps(
    item.current_period_start,
    item.current_period_end,
  );
}

function subscriptionItems(source: ClerkBillingPeriodSource): ClerkBillingPeriodItem[] {
  return source.items ?? source.subscription_items ?? [];
}

function pickPreferredItem(
  items: ClerkBillingPeriodItem[],
  preferPaidPlan: boolean,
  isFreePlanSlug: (slug: string) => boolean,
): ClerkBillingPeriodItem | null {
  const activeItems = items.filter((item) =>
    isActiveBillingItemStatus(item.status),
  );
  if (activeItems.length === 0) return null;

  if (preferPaidPlan) {
    for (const item of activeItems) {
      const slug = item.plan?.slug;
      if (slug && !isFreePlanSlug(slug) && periodFromItem(item)) {
        return item;
      }
    }
  }

  for (const item of activeItems) {
    if (periodFromItem(item)) return item;
  }

  return null;
}

/**
 * Read billing cycle boundaries from Clerk subscription payloads.
 * Clerk stores canonical `period_start` / `period_end` on subscription items.
 */
export function extractClerkBillingPeriod(
  source: ClerkBillingPeriodSource,
  options?: { preferPaidPlan?: boolean; isFreePlanSlug?: (slug: string) => boolean },
): ClerkBillingPeriod | null {
  const preferPaidPlan = options?.preferPaidPlan ?? true;
  const isFreePlanSlug = options?.isFreePlanSlug ?? isFreeClerkPlanSlug;

  const preferredItem = pickPreferredItem(
    subscriptionItems(source),
    preferPaidPlan,
    isFreePlanSlug,
  );
  if (preferredItem) {
    const fromItem = periodFromItem(preferredItem);
    if (fromItem) return fromItem;
  }

  const fromRootClerk = periodFromTimestamps(source.period_start, source.period_end);
  if (fromRootClerk) return fromRootClerk;

  return periodFromTimestamps(
    source.current_period_start,
    source.current_period_end,
  );
}

/** Map extracted period to optional org update fields (empty when unavailable). */
export function clerkBillingPeriodFields(
  source: ClerkBillingPeriodSource,
  options?: { preferPaidPlan?: boolean; isFreePlanSlug?: (slug: string) => boolean },
): {
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
} {
  const period = extractClerkBillingPeriod(source, options);
  if (!period) return {};
  return period;
}

export function isValidBillingPeriodDate(date: Date | null | undefined): boolean {
  return date instanceof Date && Number.isFinite(date.getTime());
}
