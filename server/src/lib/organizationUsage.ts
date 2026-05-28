import type { Plan } from "../../../src/generated/prisma/client";
import { prisma } from "./prisma";
import { getStripeOrNull } from "./stripe";
import { getStripeSubscriptionPeriod } from "./stripeSubscriptionPeriod";

export type OrganizationUsagePayload = {
  plan: Plan;
  ordersThisMonth: number;
  orderLimit: number;
  currentPeriodEnd: string;
  cancelAtPeriodEnd?: boolean;
};

const orgSelect = {
  plan: true,
  ordersThisMonth: true,
  orderLimit: true,
  currentPeriodEnd: true,
  stripeSubscriptionId: true,
} as const;

function baseUsage(org: {
  plan: Plan;
  ordersThisMonth: number;
  orderLimit: number;
  currentPeriodEnd: Date;
}): OrganizationUsagePayload {
  return {
    plan: org.plan,
    ordersThisMonth: org.ordersThisMonth,
    orderLimit: org.orderLimit,
    currentPeriodEnd: org.currentPeriodEnd.toISOString(),
  };
}

/** Build organization usage for auth responses; enriches PRO subs from Stripe when available. */
export async function buildOrganizationUsage(
  orgId: string,
): Promise<OrganizationUsagePayload | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: orgSelect,
  });

  if (!org) return null;

  const usage = baseUsage(org);

  if (org.plan !== "PRO" || !org.stripeSubscriptionId) {
    return usage;
  }

  const stripe = getStripeOrNull();
  if (!stripe) return usage;

  try {
    const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
    const period = getStripeSubscriptionPeriod(sub);
    if (!period) return usage;

    await prisma.organization.update({
      where: { id: orgId },
      data: {
        currentPeriodStart: period.currentPeriodStart,
        currentPeriodEnd: period.currentPeriodEnd,
      },
    });

    return {
      ...usage,
      currentPeriodEnd: period.currentPeriodEnd.toISOString(),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    };
  } catch {
    return usage;
  }
}

/** Sync Stripe subscription period dates into Organization (webhooks + cancel/reactivate). */
export async function syncOrganizationFromStripeSubscription(
  orgId: string,
  sub: Parameters<typeof getStripeSubscriptionPeriod>[0],
): Promise<void> {
  const period = getStripeSubscriptionPeriod(sub);
  if (!period) return;

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      currentPeriodStart: period.currentPeriodStart,
      currentPeriodEnd: period.currentPeriodEnd,
    },
  });
}
