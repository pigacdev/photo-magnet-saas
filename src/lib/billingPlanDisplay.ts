/** Marketing copy for billing plan cards (mirrors billing.json + planCatalog limits). */
export type BillingPlanColumn = {
  slug: "free_user" | "hobby" | "pro";
  features: readonly string[];
};

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
      "All magnet shape presets",
      "Magnetoo Studio print branding",
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
      "Order email notifications",
      "Customer support",
      "Up to 50 orders per billing period",
      "Up to 5 events per billing period",
    ],
  },
  {
    slug: "pro",
    features: [
      "Everything in Hobby",
      "Priority customer support",
      "Orders CSV export",
      "Unlimited orders per billing period",
      "Unlimited events per billing period",
    ],
  },
] as const;
