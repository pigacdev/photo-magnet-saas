import { prisma } from "./prisma";
import {
  EARLY_ACCESS_HEADS_UP_DAYS,
  EARLY_ACCESS_LOYALTY_TRANSITION_DAYS,
  addDays,
} from "../../../src/lib/earlyAccess";
import {
  fetchActiveSubscriptionItem,
  resolveCurrentPriceIdFromSlug,
  resolveEarlyAccessTransitionTarget,
  transitionSubscriptionPrice,
} from "../../../src/lib/clerkBillingAdmin";
import { planDisplayName } from "./planCatalog";
import {
  sendEarlyAccessExpiryEmail,
  sendEarlyAccessHeadsUpEmail,
} from "./email";

function billingPageUrl(): string {
  const base =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/dashboard/billing`;
}

/**
 * Transition grantLifetimeDiscount orgs to loyalty pricing before Clerk's
 * first charge at trial end (paid→paid transition schedules at period end).
 */
export async function runEarlyAccessLoyaltyTransitionJob(): Promise<{
  processed: number;
  errors: string[];
}> {
  const now = new Date();
  const windowEnd = addDays(now, EARLY_ACCESS_LOYALTY_TRANSITION_DAYS);

  const orgs = await prisma.organization.findMany({
    where: {
      isEarlyAccess: true,
      grantLifetimeDiscount: true,
      earlyAccessExpiresAt: { gt: now, lte: windowEnd },
      clerkPlanSlug: { in: ["hobby", "pro"] },
    },
    select: {
      id: true,
      plan: true,
      clerkPlanSlug: true,
      user: { select: { clerkId: true } },
    },
  });

  const errors: string[] = [];
  let processed = 0;

  for (const org of orgs) {
    try {
      const clerkUserId = org.user.clerkId;
      if (!clerkUserId) {
        errors.push(`${org.id}: missing clerkId`);
        continue;
      }

      const target = resolveEarlyAccessTransitionTarget({
        plan: org.plan,
        grantLifetimeDiscount: true,
        currentClerkPlanSlug: org.clerkPlanSlug,
      });
      if (!target) {
        errors.push(`${org.id}: could not resolve loyalty target`);
        continue;
      }

      const item = await fetchActiveSubscriptionItem(clerkUserId);
      const fromPriceId =
        item?.priceId ?? resolveCurrentPriceIdFromSlug(org.clerkPlanSlug);
      if (!item?.subscriptionItemId || !fromPriceId) {
        errors.push(`${org.id}: missing subscription item or from price`);
        continue;
      }

      const transitioned = await transitionSubscriptionPrice(
        item.subscriptionItemId,
        fromPriceId,
        target.priceId,
      );
      if (!transitioned) {
        errors.push(`${org.id}: loyalty price_transition failed`);
        continue;
      }

      await prisma.organization.update({
        where: { id: org.id },
        data: { clerkPlanSlug: target.planSlug },
      });

      processed += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${org.id}: ${msg}`);
    }
  }

  return { processed, errors };
}

/**
 * Clear early-access flags after trial ends. Clerk handles billing for
 * non-loyalty orgs; loyalty transitions run in runEarlyAccessLoyaltyTransitionJob.
 */
export async function runEarlyAccessCleanupJob(): Promise<{
  processed: number;
  errors: string[];
}> {
  const now = new Date();
  const orgs = await prisma.organization.findMany({
    where: {
      isEarlyAccess: true,
      earlyAccessExpiresAt: { lt: now },
    },
    select: {
      id: true,
      plan: true,
      grantLifetimeDiscount: true,
      clerkPlanSlug: true,
      user: { select: { email: true, name: true, marketingEmailsOptOut: true } },
    },
  });

  const errors: string[] = [];
  let processed = 0;

  for (const org of orgs) {
    try {
      await prisma.organization.update({
        where: { id: org.id },
        data: {
          isEarlyAccess: false,
          earlyAccessExpiresAt: null,
        },
      });

      if (!org.user.marketingEmailsOptOut) {
        await sendEarlyAccessExpiryEmail({
          to: org.user.email,
          sellerName: org.user.name,
          newPlanLabel: planDisplayName(org.plan),
          hasLifetimeDiscount: org.grantLifetimeDiscount,
          billingUrl: billingPageUrl(),
        });
      }

      processed += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${org.id}: ${msg}`);
    }
  }

  return { processed, errors };
}

export async function runEarlyAccessHeadsUpJob(): Promise<{
  sent: number;
  errors: string[];
}> {
  const now = new Date();
  const windowStart = addDays(now, EARLY_ACCESS_HEADS_UP_DAYS - 1);
  const windowEnd = addDays(now, EARLY_ACCESS_HEADS_UP_DAYS + 1);

  const orgs = await prisma.organization.findMany({
    where: {
      isEarlyAccess: true,
      earlyAccessHeadsUpSentAt: null,
      earlyAccessExpiresAt: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    select: {
      id: true,
      earlyAccessExpiresAt: true,
      user: { select: { email: true, name: true, marketingEmailsOptOut: true } },
    },
  });

  const errors: string[] = [];
  let sent = 0;

  for (const org of orgs) {
    if (!org.earlyAccessExpiresAt) continue;
    try {
      if (!org.user.marketingEmailsOptOut) {
        await sendEarlyAccessHeadsUpEmail({
          to: org.user.email,
          sellerName: org.user.name,
          expiresAt: org.earlyAccessExpiresAt,
          billingUrl: billingPageUrl(),
        });
      }
      await prisma.organization.update({
        where: { id: org.id },
        data: { earlyAccessHeadsUpSentAt: new Date() },
      });
      sent += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${org.id}: ${msg}`);
    }
  }

  return { sent, errors };
}
