import { BILLING_PLAN_COLUMNS } from "@/lib/billingPlanDisplay";

export function BillingPlanFeatureLists() {
  return (
    <div
      className="billing-plan-features-grid"
      aria-label="Plan features"
    >
      {BILLING_PLAN_COLUMNS.map((plan) => (
        <div key={plan.slug} className="billing-plan-features-col">
          <ul className="space-y-2.5">
            {plan.features.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2 text-sm text-foreground"
              >
                <span
                  className="mt-0.5 shrink-0 text-primary"
                  aria-hidden
                >
                  ✓
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
