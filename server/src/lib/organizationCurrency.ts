import { prisma } from "./prisma";
import { normalizeCurrencyCode, type SupportedCurrency } from "./currency";

export async function organizationHasCommittedOrders(
  orgId: string,
): Promise<boolean> {
  const count = await prisma.order.count({
    where: { organizationId: orgId },
  });
  return count > 0;
}

export async function getOrganizationCurrency(
  orgId: string,
): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { currency: true },
  });
  return org?.currency ?? null;
}

export const SELLER_CURRENCY_NOT_CONFIGURED_MESSAGE =
  "This shop is not ready to accept orders yet.";

export const SELLER_SETUP_INCOMPLETE_CODE = "SELLER_SETUP_INCOMPLETE";

export async function isOrganizationCurrencyConfigured(
  orgId: string,
): Promise<boolean> {
  const currency = await getOrganizationCurrency(orgId);
  return currency != null && currency.length > 0;
}

/** Update active pricing rows for all seller contexts when currency changes pre-order. */
export async function syncSellerPricingCurrency(
  userId: string,
  currency: SupportedCurrency,
): Promise<void> {
  const events = await prisma.event.findMany({
    where: { userId, deletedAt: null },
    select: { id: true },
  });
  const storefronts = await prisma.storefront.findMany({
    where: { userId, deletedAt: null },
    select: { id: true },
  });

  const eventIds = events.map((e) => e.id);
  const storefrontIds = storefronts.map((s) => s.id);

  if (eventIds.length > 0) {
    await prisma.pricing.updateMany({
      where: {
        contextType: "EVENT",
        contextId: { in: eventIds },
        deletedAt: null,
      },
      data: { currency },
    });
  }

  if (storefrontIds.length > 0) {
    await prisma.pricing.updateMany({
      where: {
        contextType: "STOREFRONT",
        contextId: { in: storefrontIds },
        deletedAt: null,
      },
      data: { currency },
    });
  }
}

export async function patchOrganizationCurrency(
  orgId: string,
  rawCurrency: string,
): Promise<
  | { ok: true; currency: SupportedCurrency; initialSetupAt: Date | null }
  | { ok: false; status: number; error: string }
> {
  const currency = normalizeCurrencyCode(rawCurrency);
  if (!currency) {
    return { ok: false, status: 400, error: "Invalid or unsupported currency" };
  }

  const existing = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { currency: true, initialSetupAt: true },
  });

  if (!existing) {
    return { ok: false, status: 404, error: "Organization not found" };
  }

  if (existing.currency != null && existing.currency !== currency) {
    return {
      ok: false,
      status: 400,
      error: "Currency cannot be changed after initial setup",
    };
  }

  if (existing.currency === currency) {
    return {
      ok: true,
      currency: existing.currency as SupportedCurrency,
      initialSetupAt: existing.initialSetupAt,
    };
  }

  const isFirstSetup = existing.currency == null;

  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: {
      currency,
      ...(isFirstSetup && !existing.initialSetupAt
        ? { initialSetupAt: new Date() }
        : {}),
    },
    select: { currency: true, initialSetupAt: true },
  });

  return {
    ok: true,
    currency: updated.currency as SupportedCurrency,
    initialSetupAt: updated.initialSetupAt,
  };
}
