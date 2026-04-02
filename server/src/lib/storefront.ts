type StorefrontRecord = {
  isActive: boolean;
  deletedAt: Date | null;
};

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
 * Enforces: not soft-deleted (`isStorefrontOpen` checks `deletedAt`), `isActive === true`,
 * and at least one non-deleted pricing row (`pricingCount` from `Pricing` where `deletedAt: null`).
 */
export function canStorefrontAcceptOrders(
  storefront: StorefrontRecord,
  pricingCount: number,
): { ok: true } | { ok: false; reason: string } {
  if (!isStorefrontOpen(storefront)) {
    return { ok: false, reason: "Storefront is not open" };
  }
  if (pricingCount === 0) {
    return { ok: false, reason: "Pricing not configured" };
  }
  return { ok: true };
}
