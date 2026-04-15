import { prisma } from "./prisma";

export const ORDER_LIMIT_REACHED = "ORDER_LIMIT_REACHED";

/** Next monthly billing boundary from `from` (default: now + 1 calendar month). */
export function defaultBillingPeriodEnd(from: Date = new Date()): Date {
  const end = new Date(from);
  end.setMonth(end.getMonth() + 1);
  return end;
}

export async function assertCanCreateOrder(orgId: string): Promise<void> {
  const now = new Date();
  const newEnd = defaultBillingPeriodEnd(now);

  /** Only rows still in the previous period match — at most one concurrent reset wins. */
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

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
  });

  if (!org) throw new Error("Organization not found");

  if (org.plan === "PRO") return;

  if (org.ordersThisMonth >= org.orderLimit) {
    throw new Error(ORDER_LIMIT_REACHED);
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
