import type { Plan } from "../../../src/generated/prisma/client";
import { prisma } from "./prisma";
import { planDisplayName } from "./planCatalog";
import { reconcileOrganizationEventUsage } from "./saas";

export type OrganizationUsagePayload = {
  plan: Plan;
  planLabel: string;
  ordersThisMonth: number;
  orderLimit: number;
  eventsCreatedThisMonth: number;
  eventLimit: number;
  currentPeriodEnd: string;
  clerkPlanSlug?: string | null;
  currency: string | null;
  initialSetupAt: string | null;
};

const orgSelect = {
  plan: true,
  ordersThisMonth: true,
  orderLimit: true,
  eventsCreatedThisMonth: true,
  eventLimit: true,
  currentPeriodEnd: true,
  clerkPlanSlug: true,
  currency: true,
  initialSetupAt: true,
} as const;

function baseUsage(org: {
  plan: Plan;
  ordersThisMonth: number;
  orderLimit: number;
  eventsCreatedThisMonth: number;
  eventLimit: number;
  currentPeriodEnd: Date;
  clerkPlanSlug?: string | null;
  currency: string | null;
  initialSetupAt: Date | null;
}): OrganizationUsagePayload {
  return {
    plan: org.plan,
    planLabel: planDisplayName(org.plan),
    ordersThisMonth: org.ordersThisMonth,
    orderLimit: org.orderLimit,
    eventsCreatedThisMonth: org.eventsCreatedThisMonth,
    eventLimit: org.eventLimit,
    currentPeriodEnd: org.currentPeriodEnd.toISOString(),
    clerkPlanSlug: org.clerkPlanSlug,
    currency: org.currency,
    initialSetupAt: org.initialSetupAt?.toISOString() ?? null,
  };
}

export async function buildOrganizationUsage(
  orgId: string,
): Promise<OrganizationUsagePayload | null> {
  let eventsCreatedThisMonth = 0;
  try {
    eventsCreatedThisMonth = await reconcileOrganizationEventUsage(orgId);
  } catch (err) {
    console.error("[buildOrganizationUsage] reconcile failed", orgId, err);
    return null;
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: orgSelect,
  });

  if (!org) return null;

  return {
    ...baseUsage(org),
    eventsCreatedThisMonth,
  };
}
