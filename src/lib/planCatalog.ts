import type { Plan } from "@/generated/prisma/client";

/** Clerk Dashboard User Plan slug → app limits. Keep slugs in sync with Billing → Plans. */
export type PlanSlug = "free" | "free_user" | "hobby" | "pro";

export const FREE_PRINT_BRAND_TEXT = "Magnetoo Studio";

/** Default print brand for paid plans when brandText is unset. */
export const DEFAULT_PRINT_BRAND_TEXT = "Magnetoo";

/** Sentinel for unlimited orders / events per billing period. */
export const UNLIMITED_ENTITLEMENT = 999_999;

export type PlanEntitlements = {
  plan: Plan;
  orderLimit: number;
  eventLimit: number;
  label: string;
  features: readonly string[];
};

const FREE_FEATURES = ["analytics_basic", "qr_ordering"] as const;

const HOBBY_FEATURES = [
  "analytics_basic",
  "analytics_advanced",
  "analytics_event",
  "calendar",
  "custom_branding",
  "email_notifications",
  "manual_send_email",
  "qr_ordering",
  "support",
  "vacation_mode",
] as const;

const PRO_FEATURES = [
  ...HOBBY_FEATURES,
  "priority_support",
  "orders_export_csv",
  "customers",
] as const;

export const PLAN_ENTITLEMENTS: Record<string, PlanEntitlements> = {
  free_user: {
    plan: "FREE",
    orderLimit: 10,
    eventLimit: 1,
    label: "Free",
    features: FREE_FEATURES,
  },
  free: {
    plan: "FREE",
    orderLimit: 10,
    eventLimit: 1,
    label: "Free",
    features: FREE_FEATURES,
  },
  hobby: {
    plan: "HOBBY",
    orderLimit: 50,
    eventLimit: 5,
    label: "Hobby",
    features: HOBBY_FEATURES,
  },
  pro: {
    plan: "PRO",
    orderLimit: UNLIMITED_ENTITLEMENT,
    eventLimit: UNLIMITED_ENTITLEMENT,
    label: "Pro",
    features: PRO_FEATURES,
  },
};

/** @deprecated Use PLAN_ENTITLEMENTS — kept for webhook sync fields. */
export type PlanLimitConfig = Pick<
  PlanEntitlements,
  "plan" | "orderLimit" | "label"
> & { orderLimit: number };

export const PLAN_LIMITS: Record<string, PlanLimitConfig> = Object.fromEntries(
  Object.entries(PLAN_ENTITLEMENTS).map(([slug, e]) => [
    slug,
    { plan: e.plan, orderLimit: e.orderLimit, label: e.label },
  ]),
);

/** Clerk feature slugs per plan (mirror Dashboard attachments). */
export const PLAN_FEATURE_SLUGS: Record<string, string[]> = Object.fromEntries(
  Object.entries(PLAN_ENTITLEMENTS).map(([slug, e]) => [slug, [...e.features]]),
);

export function isFreeClerkPlanSlug(slug: string): boolean {
  const normalized = slug.toLowerCase();
  return normalized === "free" || normalized === "free_user";
}

export function resolvePlanEntitlements(
  clerkPlanSlug: string | null | undefined,
): PlanEntitlements {
  if (!clerkPlanSlug) {
    return PLAN_ENTITLEMENTS.free_user;
  }
  const normalized = clerkPlanSlug.toLowerCase();
  return (
    PLAN_ENTITLEMENTS[normalized] ??
    PLAN_ENTITLEMENTS[clerkPlanSlug] ??
    PLAN_ENTITLEMENTS.free_user
  );
}

export function resolvePlanLimits(clerkPlanSlug: string | null | undefined): PlanLimitConfig {
  const e = resolvePlanEntitlements(clerkPlanSlug);
  return { plan: e.plan, orderLimit: e.orderLimit, label: e.label };
}

export function entitlementsForPlan(plan: Plan): PlanEntitlements {
  switch (plan) {
    case "PRO":
      return PLAN_ENTITLEMENTS.pro;
    case "HOBBY":
      return PLAN_ENTITLEMENTS.hobby;
    default:
      return PLAN_ENTITLEMENTS.free_user;
  }
}

export function planHasFeature(plan: Plan, feature: string): boolean {
  return entitlementsForPlan(plan).features.includes(feature);
}

export function isPaidPlan(plan: Plan): boolean {
  return plan === "HOBBY" || plan === "PRO";
}

export function hasUnlimitedOrders(orderLimit: number): boolean {
  return orderLimit >= UNLIMITED_ENTITLEMENT;
}

export function hasUnlimitedEvents(eventLimit: number): boolean {
  return eventLimit >= UNLIMITED_ENTITLEMENT;
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
