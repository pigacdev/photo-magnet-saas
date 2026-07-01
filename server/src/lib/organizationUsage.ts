import type { Plan } from "../../../src/generated/prisma/client";
import { prisma } from "./prisma";
import { planDisplayName } from "./planCatalog";
import { reconcileOrganizationEventUsage } from "./saas";
import {
  DEFAULT_DATE_FORMAT,
  DEFAULT_SIZE_UNIT,
  normalizeDateFormat,
  normalizeSizeUnit,
  type DateFormat,
  type SizeUnit,
} from "./organizationDisplayPreferences";

export type OrganizationUsagePayload = {
  plan: Plan;
  planLabel: string;
  ordersThisMonth: number;
  orderLimit: number;
  eventsCreatedThisMonth: number;
  eventLimit: number;
  currentPeriodEnd: string;
  subscriptionRenewsAt: string | null;
  clerkPlanSlug?: string | null;
  currency: string | null;
  initialSetupAt: string | null;
  dateFormat: DateFormat;
  sizeUnit: SizeUnit;
};

const orgSelect = {
  plan: true,
  ordersThisMonth: true,
  orderLimit: true,
  eventsCreatedThisMonth: true,
  eventLimit: true,
  currentPeriodEnd: true,
  subscriptionPeriodEnd: true,
  clerkPlanSlug: true,
  currency: true,
  initialSetupAt: true,
  dateFormat: true,
  sizeUnit: true,
} as const;

function baseUsage(org: {
  plan: Plan;
  ordersThisMonth: number;
  orderLimit: number;
  eventsCreatedThisMonth: number;
  eventLimit: number;
  currentPeriodEnd: Date;
  subscriptionPeriodEnd: Date | null;
  clerkPlanSlug?: string | null;
  currency: string | null;
  initialSetupAt: Date | null;
  dateFormat: string | null;
  sizeUnit: string | null;
}): OrganizationUsagePayload {
  return {
    plan: org.plan,
    planLabel: planDisplayName(org.plan),
    ordersThisMonth: org.ordersThisMonth,
    orderLimit: org.orderLimit,
    eventsCreatedThisMonth: org.eventsCreatedThisMonth,
    eventLimit: org.eventLimit,
    currentPeriodEnd: org.currentPeriodEnd.toISOString(),
    subscriptionRenewsAt: org.subscriptionPeriodEnd?.toISOString() ?? null,
    clerkPlanSlug: org.clerkPlanSlug,
    currency: org.currency,
    initialSetupAt: org.initialSetupAt?.toISOString() ?? null,
    dateFormat: normalizeDateFormat(org.dateFormat) ?? DEFAULT_DATE_FORMAT,
    sizeUnit: normalizeSizeUnit(org.sizeUnit) ?? DEFAULT_SIZE_UNIT,
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
