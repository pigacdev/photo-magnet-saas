import type { Event, Storefront } from "../../../src/generated/prisma/client";
import { prisma } from "./prisma";
import { canAcceptOrders } from "./event";
import { canStorefrontAcceptOrders } from "./storefront";
import {
  isOrganizationCurrencyConfigured,
  SELLER_CURRENCY_NOT_CONFIGURED_MESSAGE,
} from "./organizationCurrency";
import {
  BUYER_EVENT_ORDER_LIMIT_MESSAGE,
  BUYER_STORE_ORDER_LIMIT_MESSAGE,
  canOrganizationAcceptOrders,
} from "./saas";

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

  const currencyReady = await isOrganizationCurrencyConfigured(event.userId);
  if (!currencyReady) {
    return {
      ok: false,
      notFound: false,
      reason: SELLER_CURRENCY_NOT_CONFIGURED_MESSAGE,
    };
  }

  const [pricing, shapeCount] = await Promise.all([
    prisma.pricing.findMany({
      where: { contextType: "EVENT", contextId: event.id, deletedAt: null },
    }),
    prisma.allowedShape.count({
      where: { contextType: "EVENT", contextId: event.id },
    }),
  ]);

  const check = canAcceptOrders(event, pricing.length, shapeCount);
  if (!check.ok) {
    return { ok: false, notFound: false, reason: check.reason };
  }

  const orgLimit = await canOrganizationAcceptOrders(event.userId);
  if (!orgLimit.ok) {
    return {
      ok: false,
      notFound: false,
      reason: BUYER_EVENT_ORDER_LIMIT_MESSAGE,
    };
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

  const currencyReady = await isOrganizationCurrencyConfigured(storefront.userId);
  if (!currencyReady) {
    return {
      ok: false,
      notFound: false,
      reason: SELLER_CURRENCY_NOT_CONFIGURED_MESSAGE,
    };
  }

  const [pricing, shapeCount] = await Promise.all([
    prisma.pricing.findMany({
      where: { contextType: "STOREFRONT", contextId: storefront.id, deletedAt: null },
    }),
    prisma.allowedShape.count({
      where: { contextType: "STOREFRONT", contextId: storefront.id },
    }),
  ]);

  const check = canStorefrontAcceptOrders(storefront, pricing.length, shapeCount);
  if (!check.ok) {
    return { ok: false, notFound: false, reason: check.reason };
  }

  const orgLimit = await canOrganizationAcceptOrders(storefront.userId);
  if (!orgLimit.ok) {
    return {
      ok: false,
      notFound: false,
      reason: BUYER_STORE_ORDER_LIMIT_MESSAGE,
    };
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
