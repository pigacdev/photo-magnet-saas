/** Marketing copy for billing plan cards (mirrors billing.json + planCatalog limits). */
export type BillingPlanColumnSlug = "free_user" | "hobby" | "pro";

export type BillingPlanColumn = {
  slug: BillingPlanColumnSlug;
  features: readonly string[];
};

const HOBBY_TRIAL_FEATURES = [
  "60-day free trial — card required",
  "Everything in Free",
  "Advanced analytics",
  "Event analytics",
  "Event calendar",
  "Custom print branding",
  "Professional branded email notifications",
  "Send email to customers",
  "Customer support",
  "Up to 50 orders per billing period",
  "Up to 5 events per billing period",
  "Storefront vacation mode",
] as const;

const PRO_TRIAL_FEATURES = [
  "60-day free trial — card required",
  "Everything in Hobby",
  "Priority customer support",
  "Customer management",
  "Orders CSV export",
  "Unlimited orders per billing period",
  "Unlimited events per billing period",
] as const;

export const BILLING_PLAN_COLUMNS: readonly BillingPlanColumn[] = [
  {
    slug: "free_user",
    features: [
      "Print-ready PDFs",
      "QR code ordering",
      "Basic analytics",
      "Up to 10 orders per billing period",
      "Up to 1 event per billing period",
      "1 storefront",
      "Magnetoo Studio print branding",
      "Professional branded email notifications",
    ],
  },
  {
    slug: "hobby",
    features: [
      "Everything in Free",
      "Advanced analytics",
      "Event analytics",
      "Event calendar",
      "Custom print branding",
      "Professional branded email notifications",
      "Send email to customers",
      "Customer support",
      "Up to 50 orders per billing period",
      "Up to 5 events per billing period",
      "Storefront vacation mode",
    ],
  },
  {
    slug: "pro",
    features: [
      "Everything in Hobby",
      "Priority customer support",
      "Customer management",
      "Orders CSV export",
      "Unlimited orders per billing period",
      "Unlimited events per billing period",
    ],
  },
] as const;

/** Feature lists when early-access free trials are active on hobby/pro. */
export const BILLING_PLAN_COLUMNS_TRIAL: readonly BillingPlanColumn[] = [
  BILLING_PLAN_COLUMNS[0],
  { slug: "hobby", features: HOBBY_TRIAL_FEATURES },
  { slug: "pro", features: PRO_TRIAL_FEATURES },
] as const;

export function billingPlanColumnsForPhase(
  earlyAccessOpen: boolean,
): readonly BillingPlanColumn[] {
  return earlyAccessOpen ? BILLING_PLAN_COLUMNS_TRIAL : BILLING_PLAN_COLUMNS;
}
