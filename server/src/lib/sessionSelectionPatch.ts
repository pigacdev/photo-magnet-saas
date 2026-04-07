import type { OrderSession } from "../../../src/generated/prisma/client";
import { SYSTEM_MAX_MAGNETS_PER_ORDER } from "../config/system";
import { prisma } from "./prisma";
import { getPerItemEffectiveMaxMagnetsPerOrder } from "./maxMagnetsPerOrder";

type PatchBody = {
  selectedShapeId?: unknown;
  pricingType?: unknown;
  quantity?: unknown;
  bundleId?: unknown;
};

function roundMoney(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

/**
 * Validates shape + pricing selection and persists PER_ITEM or BUNDLE selection on the session.
 *
 * Mutual exclusivity (always enforced on write):
 * - `per_item` → `bundleId` is set to `null` (clears any prior bundle selection).
 * - `bundle` → `quantity` is set to `null` (clears any prior per-item quantity).
 *
 * Shape change: when `selectedShapeId` differs from the stored session, pricing is cleared
 * (`pricingType`, `quantity`, `bundleId`, `totalPrice` → null) so the user must pick pricing again.
 */
export async function applySessionSelectionPatch(
  session: OrderSession,
  body: PatchBody,
): Promise<
  | { ok: true; session: OrderSession }
  | { ok: false; status: number; error: string }
> {
  const selectedShapeId = body.selectedShapeId;

  if (typeof selectedShapeId !== "string" || !selectedShapeId.trim()) {
    return { ok: false, status: 400, error: "selectedShapeId is required" };
  }

  const shape = await prisma.allowedShape.findFirst({
    where: {
      id: selectedShapeId,
      contextType: session.contextType,
      contextId: session.contextId,
    },
  });

  if (!shape) {
    return { ok: false, status: 400, error: "Shape is not allowed for this context" };
  }

  const shapeChanged =
    session.selectedShapeId != null &&
    session.selectedShapeId !== shape.id;

  if (shapeChanged) {
    const updated = await prisma.orderSession.update({
      where: { id: session.id },
      data: {
        selectedShapeId: shape.id,
        pricingType: null,
        quantity: null,
        bundleId: null,
        totalPrice: null,
        lastActiveAt: new Date(),
      },
    });
    return { ok: true, session: updated };
  }

  const pricingTypeRaw = body.pricingType;

  if (pricingTypeRaw !== "per_item" && pricingTypeRaw !== "bundle") {
    return {
      ok: false,
      status: 400,
      error: 'pricingType must be "per_item" or "bundle"',
    };
  }

  const pricingRows = await prisma.pricing.findMany({
    where: {
      contextType: session.contextType,
      contextId: session.contextId,
      deletedAt: null,
    },
    orderBy: { displayOrder: "asc" },
  });

  if (pricingRows.length === 0) {
    return { ok: false, status: 400, error: "Pricing not configured" };
  }

  if (pricingTypeRaw === "per_item") {
    const perRow = pricingRows.find((p) => p.type === "PER_ITEM");
    if (!perRow) {
      return { ok: false, status: 400, error: "Per-item pricing is not available" };
    }

    const qtyRaw = body.quantity;
    if (typeof qtyRaw !== "number" || !Number.isInteger(qtyRaw) || qtyRaw < 1) {
      return { ok: false, status: 400, error: "quantity must be a positive integer" };
    }
    const effectiveMax = await getPerItemEffectiveMaxMagnetsPerOrder(session);
    const qty = Math.min(qtyRaw, effectiveMax);

    const unit = Number(perRow.price);
    const total = roundMoney(unit * qty);

    const updated = await prisma.orderSession.update({
      where: { id: session.id },
      data: {
        selectedShapeId: shape.id,
        pricingType: "PER_ITEM",
        quantity: qty,
        bundleId: null, // required: drop bundle when switching to per-item
        totalPrice: total,
        lastActiveAt: new Date(),
      },
    });

    return { ok: true, session: updated };
  }

  const bundleId = body.bundleId;
  if (typeof bundleId !== "string" || !bundleId.trim()) {
    return { ok: false, status: 400, error: "bundleId is required for bundle pricing" };
  }

  const bundleRow = pricingRows.find(
    (p) => p.id === bundleId && p.type === "BUNDLE",
  );
  if (!bundleRow) {
    return { ok: false, status: 400, error: "Bundle not found" };
  }

  const bq = bundleRow.quantity;
  if (bq == null || bq < 1) {
    return { ok: false, status: 400, error: "Bundle quantity is invalid" };
  }
  if (bq > SYSTEM_MAX_MAGNETS_PER_ORDER) {
    return {
      ok: false,
      status: 400,
      error: `Bundle cannot exceed ${SYSTEM_MAX_MAGNETS_PER_ORDER} magnets`,
    };
  }

  const total = roundMoney(Number(bundleRow.price));

  const updated = await prisma.orderSession.update({
    where: { id: session.id },
    data: {
      selectedShapeId: shape.id,
      pricingType: "BUNDLE",
      quantity: null, // required: drop per-item qty when switching to bundle
      bundleId: bundleRow.id,
      totalPrice: total,
      lastActiveAt: new Date(),
    },
  });

  return { ok: true, session: updated };
}
