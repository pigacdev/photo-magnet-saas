/** Canonical storefront shipping values stored in `Order.shippingType` and API bodies. */
export const STOREFRONT_SHIPPING_TYPES = [
  "pickup",
  "delivery",
  "boxnow",
] as const;

export type StorefrontShippingType =
  (typeof STOREFRONT_SHIPPING_TYPES)[number];

const LABELS: Record<StorefrontShippingType, string> = {
  pickup: "Pickup",
  delivery: "Delivery",
  boxnow: "BoxNow",
};

/** Map legacy Standard/Express → delivery; normalize casing. */
export function normalizeLegacyShippingType(
  input: string | null | undefined,
): StorefrontShippingType {
  const t = (input ?? "").trim().toLowerCase();
  if (t === "standard" || t === "express") return "delivery";
  if (STOREFRONT_SHIPPING_TYPES.includes(t as StorefrontShippingType)) {
    return t as StorefrontShippingType;
  }
  return "delivery";
}

export function shippingTypeLabel(
  input: string | null | undefined,
): string {
  return LABELS[normalizeLegacyShippingType(input)];
}
