import type { OrderSession } from "../../../src/generated/prisma/client";
import { prisma } from "./prisma";
import { getPerItemEffectiveMaxMagnetsPerOrder } from "./maxMagnetsPerOrder";

/**
 * Max session images for upload:
 * - PER_ITEM: min(session quantity, per-item effective cap)
 * - BUNDLE: bundle tier quantity (must be ≤ system; validated on pricing + PATCH)
 */
export async function getMaxImagesAllowed(
  session: OrderSession,
): Promise<number | null> {
  const pt = session.pricingType;

  if (pt === "PER_ITEM") {
    const q = session.quantity;
    if (q == null || q < 1) return null;
    const cap = await getPerItemEffectiveMaxMagnetsPerOrder(session);
    return Math.min(q, cap);
  }

  if (pt === "BUNDLE") {
    if (!session.bundleId) return null;
    const row = await prisma.pricing.findFirst({
      where: {
        id: session.bundleId,
        contextType: session.contextType,
        contextId: session.contextId,
        deletedAt: null,
      },
    });
    if (!row || row.type !== "BUNDLE") return null;
    const q = row.quantity;
    if (q == null || q < 1) return null;
    return q;
  }

  return null;
}
