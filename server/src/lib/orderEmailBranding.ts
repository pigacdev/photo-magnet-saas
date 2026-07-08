import type { Plan } from "../../../src/generated/prisma/client";
import type { EmailBrandingOptions } from "./email";
import { planHasFeature } from "./planCatalog";
import { loadOrderNotificationContext } from "./orderNotificationContext";

export function resolveEmailBranding(
  plan: Plan,
  context: {
    contextName: string;
    brandText?: string | null;
    bannerUrl?: string | null;
  },
): EmailBrandingOptions {
  return {
    branded: planHasFeature(plan, "custom_branding"),
    contextName: context.contextName,
    brandText: context.brandText,
    bannerUrl: context.bannerUrl,
  };
}

export async function loadOrderEmailContext(
  order: {
    contextType: "EVENT" | "STOREFRONT";
    contextId: string;
  },
  plan: Plan,
) {
  const ctx = await loadOrderNotificationContext(order);
  return {
    ...ctx,
    branding: resolveEmailBranding(plan, ctx),
  };
}
