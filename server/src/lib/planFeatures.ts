import type { Plan } from "../../../src/generated/prisma/client";
import { entitlementsForPlan, planHasFeature } from "./planCatalog";
import { prisma } from "./prisma";

export const FEATURE_REQUIRED = "FEATURE_REQUIRED";

export function organizationHasFeature(
  plan: Plan,
  feature: string,
): boolean {
  return planHasFeature(plan, feature);
}

export async function getOrganizationPlan(
  orgId: string,
): Promise<{ plan: Plan } | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  });
  if (!org) return null;
  return { plan: org.plan };
}

export async function assertOrganizationFeature(
  orgId: string,
  feature: string,
): Promise<{ plan: Plan }> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  });
  if (!org) throw new Error("Organization not found");
  if (!organizationHasFeature(org.plan, feature)) {
    throw new Error(FEATURE_REQUIRED);
  }
  return { plan: org.plan };
}

export function featureRequiredMessage(feature: string): string {
  const ent = entitlementsForPlan("PRO");
  if (feature === "orders_export_csv") {
    return "Orders CSV export is available on the Pro plan.";
  }
  if (feature === "customers") {
    return "Customer management is available on the Pro plan.";
  }
  if (feature === "analytics_event") {
    return "Event analytics is available on the Hobby plan or higher.";
  }
  if (feature === "support") {
    return "Contact support is available on the Hobby plan or higher.";
  }
  if (feature === "priority_support") {
    return "Priority support is included with the Pro plan.";
  }
  if (ent.features.includes(feature)) {
    return "This feature requires a paid plan. Upgrade to continue.";
  }
  return "This feature is not available on your current plan.";
}
