import type { Plan } from "../../../src/generated/prisma/client";
import type { EmailBrandingOptions } from "./email";
import { getOrganizationName } from "./organizationName";
import { planHasFeature } from "./planCatalog";
import { loadOrderNotificationContext } from "./orderNotificationContext";
import { prisma } from "./prisma";

export function resolveEmailBranding(
  plan: Plan,
  context: {
    contextName: string;
    organizationName: string | null;
    brandText?: string | null;
    bannerUrl?: string | null;
  },
): EmailBrandingOptions {
  return {
    branded: planHasFeature(plan, "custom_branding"),
    contextName: context.contextName,
    organizationName: context.organizationName,
    brandText: context.brandText,
    bannerUrl: context.bannerUrl,
  };
}

async function resolveOrganizationIdForOrderContext(order: {
  contextType: "EVENT" | "STOREFRONT";
  contextId: string;
}): Promise<string | null> {
  if (order.contextType === "EVENT") {
    const event = await prisma.event.findFirst({
      where: { id: order.contextId, deletedAt: null },
      select: { userId: true },
    });
    return event?.userId ?? null;
  }

  const storefront = await prisma.storefront.findFirst({
    where: { id: order.contextId, deletedAt: null },
    select: { userId: true },
  });
  return storefront?.userId ?? null;
}

export async function loadOrderEmailContext(
  order: {
    contextType: "EVENT" | "STOREFRONT";
    contextId: string;
  },
  plan: Plan,
) {
  const ctx = await loadOrderNotificationContext(order);
  const orgId = await resolveOrganizationIdForOrderContext(order);
  const organizationName = orgId ? await getOrganizationName(orgId) : null;

  return {
    ...ctx,
    organizationName,
    branding: resolveEmailBranding(plan, { ...ctx, organizationName }),
  };
}
