import type { StructuredShippingAddress } from "../../../src/lib/shippingAddress";
import { storedPickupAddressFromJson } from "./parsePickupAddressInput";
import { prisma } from "./prisma";

type StorefrontRecord = {
  isActive: boolean;
  deletedAt: Date | null;
};

export async function loadStorefrontPickupAddress(
  storefrontId: string,
): Promise<StructuredShippingAddress | null> {
  const sf = await prisma.storefront.findFirst({
    where: { id: storefrontId, deletedAt: null },
    select: { pickupAddress: true },
  });
  if (!sf) return null;
  return storedPickupAddressFromJson(sf.pickupAddress);
}

export function isStorefrontOpen(storefront: StorefrontRecord): boolean {
  if (storefront.deletedAt !== null) return false;
  return storefront.isActive;
}

export function enrichStorefront(storefront: StorefrontRecord) {
  return {
    isOpen: isStorefrontOpen(storefront),
  };
}

/**
 * Storefront must be loadable with `deletedAt: null` by the caller.
 * Enforces: not soft-deleted, `isActive === true`, at least one shape, and pricing rows.
 */
export function getStorefrontConfigurationIssues(
  shapeCount: number,
  pricingCount: number,
): string[] {
  const issues: string[] = [];
  if (shapeCount === 0) {
    issues.push("At least one magnet shape is required");
  }
  if (pricingCount === 0) {
    issues.push("Pricing is required");
  }
  return issues;
}

export function isStorefrontConfigurationComplete(
  shapeCount: number,
  pricingCount: number,
): boolean {
  return getStorefrontConfigurationIssues(shapeCount, pricingCount).length === 0;
}

export function canStorefrontAcceptOrders(
  storefront: StorefrontRecord,
  pricingCount: number,
  shapeCount: number,
): { ok: true } | { ok: false; reason: string } {
  if (!isStorefrontOpen(storefront)) {
    return { ok: false, reason: "Storefront is not open" };
  }
  const configIssues = getStorefrontConfigurationIssues(shapeCount, pricingCount);
  if (configIssues.length > 0) {
    return { ok: false, reason: configIssues[0]! };
  }
  return { ok: true };
}
