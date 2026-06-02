import { prisma } from "./prisma";
import { normalizeOrderReference } from "../../../src/lib/orderReference";

export type SellerOrderReferenceMatch = {
  id: string;
  shortCode: string | null;
};

/**
 * Resolve a seller order from a pasted reference: full UUID, shortCode, or
 * 8-char id prefix (same as `formatOrderReference` / Copy reference).
 */
export async function findSellerOrderByReference(
  organizationId: string,
  referenceRaw: string,
): Promise<SellerOrderReferenceMatch | null> {
  const ref = normalizeOrderReference(referenceRaw);
  if (!ref) return null;

  const exactId = await prisma.order.findFirst({
    where: { organizationId, id: ref },
    select: { id: true, shortCode: true },
  });
  if (exactId) return exactId;

  const byShortCode = await prisma.order.findFirst({
    where: {
      organizationId,
      shortCode: { equals: ref, mode: "insensitive" },
    },
    select: { id: true, shortCode: true },
  });
  if (byShortCode) return byShortCode;

  if (ref.length >= 4 && ref.length < 36) {
    const prefixMatches = await prisma.order.findMany({
      where: {
        organizationId,
        id: { startsWith: ref, mode: "insensitive" },
      },
      select: { id: true, shortCode: true },
      take: 2,
    });
    if (prefixMatches.length === 1) return prefixMatches[0];
    if (prefixMatches.length > 1) {
      throw new Error("ORDER_AMBIGUOUS");
    }
  }

  return null;
}
