import type { OrganizationUsage } from "@/lib/auth";
import { entitlementsForPlan, planHasFeature } from "@/lib/planCatalog";

export function usageHasFeature(
  usage: OrganizationUsage | null | undefined,
  feature: string,
): boolean {
  if (!usage) return false;
  return planHasFeature(usage.plan, feature);
}

export { planHasFeature, entitlementsForPlan };
