import type { Plan } from "../../../src/generated/prisma/client";
import { prisma } from "./prisma";
import { hasUnlimitedOrders } from "./planCatalog";

export const ORDER_LIMIT_REACHED = "ORDER_LIMIT_REACHED";

export const SELLER_ORDER_LIMIT_MESSAGE =
  "Monthly order limit reached. Upgrade to continue.";

export const BUYER_STORE_ORDER_LIMIT_MESSAGE =
  "Ordering is not available for this store. Please contact the store.";

export const BUYER_EVENT_ORDER_LIMIT_MESSAGE =
  "Ordering is not available for this event. Please contact the organizer.";

export const PRO_FEATURE_REQUIRED = "PRO_FEATURE_REQUIRED";

export const PRO_FEATURE_REQUIRED_MESSAGE =
  "Contact support is available on the Pro plan.";

export type OrganizationUsageLevel = "normal" | "warning" | "reached";

/** Next monthly billing boundary from `from` (default: now + 1 calendar month). */
export function defaultBillingPeriodEnd(from: Date = new Date()): Date {
  const end = new Date(from);
  end.setMonth(end.getMonth() + 1);
  return end;
}

export function usageWarningThreshold(orderLimit: number): number {
  if (orderLimit <= 0) return 0;
  return Math.ceil(orderLimit * 0.7);
}

export function getOrganizationUsageLevel(org: {
  plan: Plan;
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

async function refreshOrganizationPeriodIfExpired(orgId: string, now: Date): Promise<void> {
  const newEnd = defaultBillingPeriodEnd(now);
  await prisma.organization.updateMany({
    where: {
      id: orgId,
      currentPeriodEnd: { lt: now },
    },
    data: {
      ordersThisMonth: 0,
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

export async function assertProPlan(orgId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
  });

  if (!org) throw new Error("Organization not found");
  if (org.plan !== "PRO") throw new Error(PRO_FEATURE_REQUIRED);
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

/**
 * Standalone increment (e.g. scripts). Order commit increments inside the same DB
 * transaction as `Order` creation — do not use this for the checkout commit path.
 */
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
