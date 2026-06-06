import { prisma } from "./prisma";
import {
  DEFAULT_PRINT_BRAND_TEXT,
  FREE_PRINT_BRAND_TEXT,
} from "../../../src/lib/planCatalog";

export { DEFAULT_PRINT_BRAND_TEXT, FREE_PRINT_BRAND_TEXT };

/** Matches Prisma `VarChar(40)`; enforced on API save. */
export const BRAND_TEXT_MAX_LEN = 40;

export type BrandTextInputResult =
  | { kind: "omit" }
  | { kind: "ok"; value: string | null }
  | { kind: "error"; error: string };

async function sellerPlanForOrder(orderId: string): Promise<"FREE" | "HOBBY" | "PRO" | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { organizationId: true },
  });
  if (!order) return null;
  const org = await prisma.organization.findUnique({
    where: { id: order.organizationId },
    select: { plan: true },
  });
  return org?.plan ?? null;
}

/**
 * Resolves printable brand line for an order from its storefront or event.
 * Free plan always uses Magnetoo Studio regardless of saved brandText.
 */
export async function getBrandTextForOrder(orderId: string): Promise<string> {
  const plan = await sellerPlanForOrder(orderId);
  if (plan === "FREE") {
    return FREE_PRINT_BRAND_TEXT;
  }

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
    if (t) return t.slice(0, BRAND_TEXT_MAX_LEN);
    return DEFAULT_PRINT_BRAND_TEXT;
  }

  if (order.contextType === "EVENT") {
    const ev = await prisma.event.findUnique({
      where: { id: order.contextId },
      select: { brandText: true },
    });
    const t = ev?.brandText?.trim();
    if (t) return t.slice(0, BRAND_TEXT_MAX_LEN);
    return DEFAULT_PRINT_BRAND_TEXT;
  }

  return DEFAULT_PRINT_BRAND_TEXT;
}

export function normalizeBrandTextInput(raw: unknown): BrandTextInputResult {
  if (raw === undefined) return { kind: "omit" };
  if (raw === null) return { kind: "ok", value: null };
  if (typeof raw !== "string") {
    return { kind: "error", error: "brandText must be a string" };
  }
  const t = raw.trim();
  if (t.length === 0) return { kind: "ok", value: null };
  if (t.length > BRAND_TEXT_MAX_LEN) {
    return {
      kind: "error",
      error: `brandText must be at most ${BRAND_TEXT_MAX_LEN} characters`,
    };
  }
  return { kind: "ok", value: t };
}
