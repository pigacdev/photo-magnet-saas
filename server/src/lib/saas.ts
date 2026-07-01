import type { Plan } from "../../../src/generated/prisma/client";
import {
  defaultBillingPeriodEnd,
  resolveUsagePeriodWindow,
} from "../../../src/lib/billingPeriod";
import { prisma } from "./prisma";
import {
  hasUnlimitedEvents,
  hasUnlimitedOrders,
  planHasFeature,
} from "./planCatalog";

export const ORDER_LIMIT_REACHED = "ORDER_LIMIT_REACHED";
export const EVENT_LIMIT_REACHED = "EVENT_LIMIT_REACHED";

export const SELLER_ORDER_LIMIT_MESSAGE =
  "Monthly order limit reached. Upgrade to continue.";

export const SELLER_EVENT_LIMIT_MESSAGE =
  "Monthly event limit reached. Upgrade your plan to create more events.";

export const BUYER_STORE_ORDER_LIMIT_MESSAGE =
  "Ordering is not available for this store. Please contact the store.";

export const BUYER_EVENT_ORDER_LIMIT_MESSAGE =
  "Ordering is not available for this event. Please contact the organizer.";

/** @deprecated Use FEATURE_REQUIRED from planFeatures */
export const PRO_FEATURE_REQUIRED = "PRO_FEATURE_REQUIRED";

export const PRO_FEATURE_REQUIRED_MESSAGE =
  "Contact support is available on the Hobby plan or higher.";

export const SUPPORT_FEATURE_REQUIRED = "SUPPORT_FEATURE_REQUIRED";

export type OrganizationUsageLevel = "normal" | "warning" | "reached";

export { advanceBillingPeriodToContain } from "../../../src/lib/billingPeriod";

function startOfLocalDay(d: Date): Date {
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  return day;
}

/**
 * If period start was bumped to `now` during rollover, events created earlier the
 * same day can fall in a dead zone. Extend the effective start to include them.
 */
export async function effectiveEventCountPeriodStart(
  orgId: string,
  periodStart: Date,
): Promise<Date> {
  const dayStart = startOfLocalDay(periodStart);
  const stranded = await prisma.event.findFirst({
    where: {
      userId: orgId,
      createdAt: {
        gte: dayStart,
        lt: periodStart,
      },
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  return stranded?.createdAt ?? periodStart;
}

export function usageWarningThreshold(limit: number): number {
  if (limit <= 0) return 0;
  return Math.ceil(limit * 0.7);
}

export function getOrganizationUsageLevel(org: {
  ordersThisMonth: number;
  orderLimit: number;
}): OrganizationUsageLevel {
  if (hasUnlimitedOrders(org.orderLimit)) return "normal";
  if (org.ordersThisMonth >= org.orderLimit) return "reached";
  if (org.ordersThisMonth >= usageWarningThreshold(org.orderLimit)) {
    return "warning";
  }
  return "normal";
}

export function getOrganizationEventUsageLevel(org: {
  eventsCreatedThisMonth: number;
  eventLimit: number;
}): OrganizationUsageLevel {
  if (hasUnlimitedEvents(org.eventLimit)) return "normal";
  if (org.eventsCreatedThisMonth >= org.eventLimit) return "reached";
  if (org.eventsCreatedThisMonth >= usageWarningThreshold(org.eventLimit)) {
    return "warning";
  }
  return "normal";
}

async function refreshOrganizationPeriodIfExpired(orgId: string, now: Date): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { currentPeriodStart: true, currentPeriodEnd: true },
  });

  if (!org) return;

  if (
    !Number.isFinite(org.currentPeriodStart.getTime()) ||
    !Number.isFinite(org.currentPeriodEnd.getTime())
  ) {
    return;
  }

  const advanced = resolveUsagePeriodWindow(
    org.currentPeriodStart,
    org.currentPeriodEnd,
    now,
  );

  const shouldResetCounters =
    advanced.currentPeriodStart.getTime() !== org.currentPeriodStart.getTime();
  const periodChanged =
    shouldResetCounters ||
    advanced.currentPeriodEnd.getTime() !== org.currentPeriodEnd.getTime();

  if (!periodChanged) return;

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      ...(shouldResetCounters
        ? { ordersThisMonth: 0, eventsCreatedThisMonth: 0 }
        : {}),
      currentPeriodStart: advanced.currentPeriodStart,
      currentPeriodEnd: advanced.currentPeriodEnd,
    },
  });
}

export async function countEventsCreatedInBillingPeriod(
  orgId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  return prisma.event.count({
    where: {
      userId: orgId,
      createdAt: {
        gte: periodStart,
        lt: periodEnd,
      },
    },
  });
}

/**
 * Align stored event usage with Event rows created in the current billing period.
 * Fixes legacy orgs where `eventsCreatedThisMonth` stayed 0 after the limit column was added.
 */
export async function reconcileOrganizationEventUsage(orgId: string): Promise<number> {
  const now = new Date();
  await refreshOrganizationPeriodIfExpired(orgId, now);

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      eventsCreatedThisMonth: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
    },
  });

  if (!org) throw new Error("Organization not found");

  if (
    !Number.isFinite(org.currentPeriodStart.getTime()) ||
    !Number.isFinite(org.currentPeriodEnd.getTime())
  ) {
    const start = new Date();
    const end = defaultBillingPeriodEnd(start);
    await prisma.organization.update({
      where: { id: orgId },
      data: {
        currentPeriodStart: start,
        currentPeriodEnd: end,
        ordersThisMonth: 0,
        eventsCreatedThisMonth: 0,
      },
    });
    return 0;
  }

  const effectiveStart = await effectiveEventCountPeriodStart(
    orgId,
    org.currentPeriodStart,
  );

  if (effectiveStart.getTime() < org.currentPeriodStart.getTime()) {
    await prisma.organization.update({
      where: { id: orgId },
      data: { currentPeriodStart: effectiveStart },
    });
  }

  const actualCount = await countEventsCreatedInBillingPeriod(
    orgId,
    effectiveStart,
    org.currentPeriodEnd,
  );

  // Keep the higher of DB count vs stored counter. The counter increments on
  // create; Clerk/local period boundaries can lag and exclude a just-created event.
  const syncedCount = Math.max(actualCount, org.eventsCreatedThisMonth);

  if (syncedCount !== org.eventsCreatedThisMonth) {
    await prisma.organization.update({
      where: { id: orgId },
      data: { eventsCreatedThisMonth: syncedCount },
    });
  }

  return syncedCount;
}

export async function assertCanCreateOrder(orgId: string): Promise<void> {
  const now = new Date();
  await refreshOrganizationPeriodIfExpired(orgId, now);

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
  });

  if (!org) throw new Error("Organization not found");

  if (hasUnlimitedOrders(org.orderLimit)) return;

  if (org.ordersThisMonth >= org.orderLimit) {
    throw new Error(ORDER_LIMIT_REACHED);
  }
}

export async function assertCanCreateEvent(orgId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { eventLimit: true },
  });

  if (!org) throw new Error("Organization not found");

  if (hasUnlimitedEvents(org.eventLimit)) return;

  const eventsCreatedThisMonth = await reconcileOrganizationEventUsage(orgId);

  if (eventsCreatedThisMonth >= org.eventLimit) {
    throw new Error(EVENT_LIMIT_REACHED);
  }
}

export async function assertHasSupport(orgId: string): Promise<Plan> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  });

  if (!org) throw new Error("Organization not found");
  if (!planHasFeature(org.plan, "support")) {
    throw new Error(SUPPORT_FEATURE_REQUIRED);
  }
  return org.plan;
}

/** @deprecated Use assertHasSupport */
export async function assertProPlan(orgId: string): Promise<void> {
  await assertHasSupport(orgId);
}

export async function canOrganizationAcceptOrders(
  orgId: string,
): Promise<{ ok: true } | { ok: false }> {
  try {
    await assertCanCreateOrder(String(orgId));
    return { ok: true };
  } catch (err) {
    if (err instanceof Error && err.message === ORDER_LIMIT_REACHED) {
      return { ok: false };
    }
    if (err instanceof Error && err.message === "Organization not found") {
      return { ok: false };
    }
    throw err;
  }
}

export async function incrementOrderUsage(orgId: string): Promise<void> {
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      ordersThisMonth: {
        increment: 1,
      },
    },
  });
}

export async function incrementEventUsage(orgId: string): Promise<void> {
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      eventsCreatedThisMonth: {
        increment: 1,
      },
    },
  });
}
