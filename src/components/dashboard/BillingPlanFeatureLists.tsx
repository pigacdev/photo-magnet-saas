import {
  billingPlanColumnsForPhase,
  type BillingPlanColumn,
} from "@/lib/billingPlanDisplay";

export function BillingPlanFeatureLists({
  earlyAccessOpen = false,
}: {
  earlyAccessOpen?: boolean;
}) {
  const columns = billingPlanColumnsForPhase(earlyAccessOpen);

  return (
    <div
      className="billing-plan-features-grid"
      aria-label="Plan features"
    >
      {columns.map((plan) => (
        <FeatureColumn key={plan.slug} plan={plan} />
      ))}
    </div>
  );
}

function FeatureColumn({ plan }: { plan: BillingPlanColumn }) {
  return (
    <div
      className={`billing-plan-features-col billing-plan-features-col--${plan.slug}`}
    >
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
  );
}
