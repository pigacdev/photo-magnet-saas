import type { Plan } from "../../../src/generated/prisma/client";
import { prisma } from "./prisma";
import { planDisplayName } from "./planCatalog";

export type OrganizationUsagePayload = {
  plan: Plan;
  planLabel: string;
  ordersThisMonth: number;
  orderLimit: number;
  currentPeriodEnd: string;
  clerkPlanSlug?: string | null;
  currency: string | null;
  initialSetupAt: string | null;
};

const orgSelect = {
  plan: true,
  ordersThisMonth: true,
  orderLimit: true,
  currentPeriodEnd: true,
  clerkPlanSlug: true,
  currency: true,
  initialSetupAt: true,
} as const;

function baseUsage(org: {
  plan: Plan;
  ordersThisMonth: number;
  orderLimit: number;
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
    currentPeriodEnd: org.currentPeriodEnd.toISOString(),
    clerkPlanSlug: org.clerkPlanSlug,
    currency: org.currency,
    initialSetupAt: org.initialSetupAt?.toISOString() ?? null,
  };
}

/** Build organization usage for auth responses (Clerk Billing synced via webhooks). */
export async function buildOrganizationUsage(
  orgId: string,
): Promise<OrganizationUsagePayload | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: orgSelect,
  });

  if (!org) return null;

  return baseUsage(org);
}
