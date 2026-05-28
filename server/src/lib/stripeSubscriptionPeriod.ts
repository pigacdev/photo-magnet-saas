import type Stripe from "stripe";

type PeriodFields = {
  current_period_start?: number;
  current_period_end?: number;
};

type SubscriptionPeriodSource = {
  items?: { data?: PeriodFields[] };
} & PeriodFields;

/** Basil+ Stripe API: billing periods live on subscription items, not the subscription root. */
export function getStripeSubscriptionPeriod(
  sub: SubscriptionPeriodSource,
): { currentPeriodStart: Date; currentPeriodEnd: Date } | null {
  const items = sub.items?.data ?? [];

  if (items.length > 0) {
    let periodStart: number | undefined;
    let periodEnd: number | undefined;

    for (const item of items) {
      if (
        item.current_period_end != null &&
        (periodEnd == null || item.current_period_end > periodEnd)
      ) {
        periodEnd = item.current_period_end;
      }
      if (
        item.current_period_start != null &&
        (periodStart == null || item.current_period_start < periodStart)
      ) {
        periodStart = item.current_period_start;
      }
    }

    if (periodStart != null && periodEnd != null) {
      return {
        currentPeriodStart: new Date(periodStart * 1000),
        currentPeriodEnd: new Date(periodEnd * 1000),
      };
    }
  }

  if (sub.current_period_start != null && sub.current_period_end != null) {
    return {
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
    };
  }

  return null;
}

export type StripeSubscriptionWithPeriod = Stripe.Subscription &
  SubscriptionPeriodSource;
