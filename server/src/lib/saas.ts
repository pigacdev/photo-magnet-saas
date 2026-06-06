import type { Plan } from "../../../src/generated/prisma/client";
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

/** Next monthly billing boundary from `from` (default: now + 1 calendar month). */
export function defaultBillingPeriodEnd(from: Date = new Date()): Date {
  const end = new Date(from);
  end.setMonth(end.getMonth() + 1);
  return end;
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
  const newEnd = defaultBillingPeriodEnd(now);
  await prisma.organization.updateMany({
    where: {
      id: orgId,
      currentPeriodEnd: { lt: now },
    },
    data: {
      ordersThisMonth: 0,
      eventsCreatedThisMonth: 0,
      currentPeriodStart: now,
      currentPeriodEnd: newEnd,
    },
  });
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
  const now = new Date();
  await refreshOrganizationPeriodIfExpired(orgId, now);

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
  });

  if (!org) throw new Error("Organization not found");

  if (hasUnlimitedEvents(org.eventLimit)) return;

  if (org.eventsCreatedThisMonth >= org.eventLimit) {
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
