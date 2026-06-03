import type { Plan } from "@/generated/prisma/client";

/** Clerk Dashboard User Plan slug → app limits. Keep slugs in sync with Billing → Plans. */
export type PlanSlug = "free" | "free_user" | "hobby" | "pro";

export type PlanLimitConfig = {
  plan: Plan;
  orderLimit: number;
  /** Display label in dashboard */
  label: string;
};

export const PLAN_LIMITS: Record<string, PlanLimitConfig> = {
  free_user: { plan: "FREE", orderLimit: 10, label: "Free" },
  free: { plan: "FREE", orderLimit: 10, label: "Free" },
  hobby: { plan: "HOBBY", orderLimit: 100, label: "Hobby" },
  pro: { plan: "PRO", orderLimit: 999_999, label: "Pro" },
};

/** Clerk feature slugs attached per plan in Dashboard (documentation + UI copy). */
export const PLAN_FEATURE_SLUGS: Record<string, string[]> = {
  free_user: [],
  free: [],
  hobby: ["custom_branding"],
  pro: ["custom_branding", "priority_support"],
};

export type PlanMarketingRow = {
  slug: PlanSlug;
  name: string;
  priceLabel: string;
  orderLimitLabel: string;
  featureBullets: string[];
};

/** Compare-table copy; align with Clerk PricingTable / Dashboard. */
export const PLAN_MARKETING: PlanMarketingRow[] = [
  {
    slug: "free",
    name: "Free",
    priceLabel: "€0",
    orderLimitLabel: "10 orders / month",
    featureBullets: ["1 storefront", "Events"],
  },
  {
    slug: "hobby",
    name: "Hobby",
    priceLabel: "€9 / month",
    orderLimitLabel: "100 orders / month",
    featureBullets: ["Custom branding on print PDFs", "1 storefront", "Events"],
  },
  {
    slug: "pro",
    name: "Pro",
    priceLabel: "€29 / month",
    orderLimitLabel: "Unlimited orders",
    featureBullets: [
      "Unlimited orders",
      "Priority support",
      "Custom branding",
      "1 storefront",
      "Events",
    ],
  },
];

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
