import type { OrderSession } from "../../../src/generated/prisma/client";
import { SYSTEM_MAX_MAGNETS_PER_ORDER } from "../config/system";
import { prisma } from "./prisma";

async function loadContextMaxMagnetsPerOrder(
  session: OrderSession,
): Promise<number | null> {
  const row =
    session.contextType === "EVENT"
      ? await prisma.event.findFirst({
          where: { id: session.contextId, deletedAt: null },
          select: { maxMagnetsPerOrder: true },
        })
      : await prisma.storefront.findFirst({
          where: { id: session.contextId, deletedAt: null },
          select: { maxMagnetsPerOrder: true },
        });
  return row?.maxMagnetsPerOrder ?? null;
}

/**
 * Per-item flow only: min(event/storefront maxMagnetsPerOrder ?? ∞, system cap).
 * Used to cap PATCH quantity and compute upload limits for PER_ITEM.
 */
export async function getPerItemEffectiveMaxMagnetsPerOrder(
  session: OrderSession,
): Promise<number> {
  const business = await loadContextMaxMagnetsPerOrder(session);
  const cap = business === null ? Infinity : business;
  return Math.min(cap, SYSTEM_MAX_MAGNETS_PER_ORDER);
}

/**
 * Session API: for bundle pricing, business maxMagnetsPerOrder does not apply.
 * For per_item (or no selection yet), use per-item effective cap.
 */
export async function getEffectiveMaxMagnetsPerOrder(
  session: OrderSession,
): Promise<number> {
  if (session.pricingType === "BUNDLE") {
    return SYSTEM_MAX_MAGNETS_PER_ORDER;
  }
  return getPerItemEffectiveMaxMagnetsPerOrder(session);
}
