import type { Event, Storefront } from "../../../src/generated/prisma/client";
import { prisma } from "./prisma";
import { canAcceptOrders } from "./event";
import { canStorefrontAcceptOrders } from "./storefront";

/**
 * Single place for “can this context start / keep an order session?” rules:
 * - Row exists and is not soft-deleted (`deletedAt: null` on load)
 * - Event: `canAcceptOrders` → open window + active + pricing rows
 * - Storefront: `canStorefrontAcceptOrders` → active + pricing rows
 */
export type EventOrderContextResult =
  | { ok: true; event: Event }
  | { ok: false; notFound: true }
  | { ok: false; notFound: false; reason: string };

export type StorefrontOrderContextResult =
  | { ok: true; storefront: Storefront }
  | { ok: false; notFound: true }
  | { ok: false; notFound: false; reason: string };

export async function validateEventOrderContext(
  contextId: string,
): Promise<EventOrderContextResult> {
  const event = await prisma.event.findUnique({
    where: { id: contextId, deletedAt: null },
  });

  if (!event) {
    return { ok: false, notFound: true };
  }

  const pricing = await prisma.pricing.findMany({
    where: { contextType: "EVENT", contextId: event.id, deletedAt: null },
  });

  const check = canAcceptOrders(event, pricing.length);
  if (!check.ok) {
    return { ok: false, notFound: false, reason: check.reason };
  }

  return { ok: true, event };
}

export async function validateStorefrontOrderContext(
  contextId: string,
): Promise<StorefrontOrderContextResult> {
  const storefront = await prisma.storefront.findUnique({
    where: { id: contextId, deletedAt: null },
  });

  if (!storefront) {
    return { ok: false, notFound: true };
  }

  const pricing = await prisma.pricing.findMany({
    where: { contextType: "STOREFRONT", contextId: storefront.id, deletedAt: null },
  });

  const check = canStorefrontAcceptOrders(storefront, pricing.length);
  if (!check.ok) {
    return { ok: false, notFound: false, reason: check.reason };
  }

  return { ok: true, storefront };
}

export type OrderSessionContextResult =
  | { ok: true }
  | { ok: false; notFound: true }
  | { ok: false; notFound: false; reason: string };

/** Re-validate an existing session row against current DB state (GET /api/session). */
export async function validateOrderSessionContext(
  contextType: "EVENT" | "STOREFRONT",
  contextId: string,
): Promise<OrderSessionContextResult> {
  if (contextType === "EVENT") {
    const r = await validateEventOrderContext(contextId);
    if (r.ok) return { ok: true };
    if (r.notFound) return { ok: false, notFound: true };
    return { ok: false, notFound: false, reason: r.reason };
  }

  const r = await validateStorefrontOrderContext(contextId);
  if (r.ok) return { ok: true };
  if (r.notFound) return { ok: false, notFound: true };
  return { ok: false, notFound: false, reason: r.reason };
}
