import type { Plan } from "../../../src/generated/prisma/client";

export type PlanLimitConfig = {
  plan: Plan;
  orderLimit: number;
  label: string;
};

export const PLAN_LIMITS: Record<string, PlanLimitConfig> = {
  free_user: { plan: "FREE", orderLimit: 10, label: "Free" },
  free: { plan: "FREE", orderLimit: 10, label: "Free" },
  hobby: { plan: "HOBBY", orderLimit: 100, label: "Hobby" },
  pro: { plan: "PRO", orderLimit: 999_999, label: "Pro" },
};

export function isFreeClerkPlanSlug(slug: string): boolean {
  const normalized = slug.toLowerCase();
  return normalized === "free" || normalized === "free_user";
}

export function resolvePlanLimits(clerkPlanSlug: string | null | undefined): PlanLimitConfig {
  if (!clerkPlanSlug) {
    return PLAN_LIMITS.free_user;
  }
  const normalized = clerkPlanSlug.toLowerCase();
  return PLAN_LIMITS[normalized] ?? PLAN_LIMITS[clerkPlanSlug] ?? PLAN_LIMITS.free_user;
}

export function isPaidPlan(plan: Plan): boolean {
  return plan === "HOBBY" || plan === "PRO";
}

export function hasUnlimitedOrders(orderLimit: number): boolean {
  return orderLimit >= 999_999;
}

export function planDisplayName(plan: Plan): string {
  switch (plan) {
    case "PRO":
      return "Pro";
    case "HOBBY":
      return "Hobby";
    default:
      return "Free";
  }
}
