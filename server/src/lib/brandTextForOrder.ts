import { prisma } from "./prisma";

/** Default label when Event/Storefront `brandText` is unset or empty. */
export const DEFAULT_PRINT_BRAND_TEXT = "@magnetooprints";

/**
 * Resolves printable brand line for an order from its storefront or event.
 */
export async function getBrandTextForOrder(orderId: string): Promise<string> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { contextType: true, contextId: true },
  });
  if (!order) return DEFAULT_PRINT_BRAND_TEXT;

  if (order.contextType === "STOREFRONT") {
    const sf = await prisma.storefront.findUnique({
      where: { id: order.contextId },
      select: { brandText: true },
    });
    const t = sf?.brandText?.trim();
    if (t) return t.slice(0, 40);
    return DEFAULT_PRINT_BRAND_TEXT;
  }

  if (order.contextType === "EVENT") {
    const ev = await prisma.event.findUnique({
      where: { id: order.contextId },
      select: { brandText: true },
    });
    const t = ev?.brandText?.trim();
    if (t) return t.slice(0, 40);
    return DEFAULT_PRINT_BRAND_TEXT;
  }

  return DEFAULT_PRINT_BRAND_TEXT;
}

/** Parse PATCH body field: omit if undefined, null if empty string, else trim + cap 40. */
export function normalizeBrandTextInput(
  raw: unknown,
): "omit" | { value: string | null } {
  if (raw === undefined) return "omit";
  if (raw === null) return { value: null };
  if (typeof raw !== "string") {
    return { value: null };
  }
  const t = raw.trim();
  if (t.length === 0) return { value: null };
  return { value: t.slice(0, 40) };
}
