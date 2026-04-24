/**
 * Shared validation + DB commit for order creation from an OrderSession.
 * Used by POST /api/orders (legacy) and POST /api/orders/finalize.
 */
import { randomUUID } from "node:crypto";
import type { OrderCommitStatus } from "../../../src/generated/prisma/client";
import { Prisma } from "../../../src/generated/prisma/client";
import { prisma } from "./prisma";
import { getStripeOrNull } from "./stripe";
import { expireOrderSessionOpenStripeCheckout } from "./stripeCheckoutSessionLifecycle";
import { SESSION_IMAGE_LIST_ORDER_BY } from "./magnetImageOrderBy";
import {
  copySessionImageToOrder,
  orderImageStorageKindFromSessionUrl,
} from "./orderImageStorage";
import { getPerItemEffectiveMaxMagnetsPerOrder } from "./maxMagnetsPerOrder";
import { assertCanCreateOrder, ORDER_LIMIT_REACHED } from "./saas";
import type { ValidatedCustomerPayload } from "./orderCustomerValidation";

type ImageCopyPayload = { imageId: string; copies: number };

export function parseImageCopiesPayload(body: unknown): ImageCopyPayload[] | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as { imageCopies?: unknown }).imageCopies;
  if (!Array.isArray(raw)) return null;
  const out: ImageCopyPayload[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") return null;
    const imageId = (row as { imageId?: unknown }).imageId;
    const copies = (row as { copies?: unknown }).copies;
    if (typeof imageId !== "string" || !imageId.trim()) return null;
    if (typeof copies !== "number" || !Number.isInteger(copies) || copies < 1) {
      return null;
    }
    out.push({ imageId: imageId.trim(), copies });
  }
  return out;
}

export function roundMoney2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

export function selectionComplete(session: {
  selectedShapeId: string | null;
  pricingType: "PER_ITEM" | "BUNDLE" | null;
  quantity: number | null;
  bundleId: string | null;
  totalPrice: { toString(): string } | null;
}): boolean {
  if (!session.selectedShapeId || !session.pricingType) return false;
  const pricingOk =
    (session.pricingType === "PER_ITEM" &&
      typeof session.quantity === "number" &&
      session.quantity >= 1) ||
    (session.pricingType === "BUNDLE" &&
      typeof session.bundleId === "string" &&
      session.bundleId.length > 0);
  if (!pricingOk) return false;
  if (session.totalPrice == null) return false;
  const tp = Number(session.totalPrice);
  return !Number.isNaN(tp) && tp > 0;
}

export type OrderCustomerInsert = {
  customerName: string | null;
  customerPhone: string | null;
  shippingType: string | null;
  shippingAddress: Prisma.InputJsonValue | typeof Prisma.JsonNull | null;
} | null;

export type PrepareCommitError =
  | { status: 400; error: string; code?: string }
  | { status: 403; error: string; code: "ORDER_LIMIT_REACHED"; message: string }
  | { status: 500; error: string };

export type PreparedOrderCommit = {
  session: Prisma.OrderSessionGetPayload<{
    include: { order: true };
  }>;
  sessionRowId: string;
  now: Date;
  organizationId: string;
  currency: string;
  /** Set when finalizing; legacy default is derived from `contextType` in prepare. */
  orderStatus: OrderCommitStatus;
  sessionImages: Awaited<ReturnType<typeof prisma.sessionImage.findMany>>;
  copiesBySessionImageId: Map<string, number>;
  commitTotalPrice: Prisma.Decimal | string | number;
  commitOrderQuantity: number | null;
  orderImageStorageKind: string;
};

/**
 * Load session, context, and images; verify shape/pricing/crops/copies. Does not
 * run SaaS order limit, does not create DB order rows.
 */
export async function prepareOrderSessionCommit(
  sessionId: string,
  body: unknown,
  now: Date,
  /** When omitted, uses EVENT → PENDING_CASH, STOREFRONT → PENDING_PAYMENT (legacy commit). */
  orderStatus: OrderCommitStatus | undefined,
): Promise<
  | { ok: "idempotent"; orderId: string; status: OrderCommitStatus }
  | { ok: true; prepared: PreparedOrderCommit }
  | { ok: false; err: PrepareCommitError }
> {
  const session = await prisma.orderSession.findUnique({
    where: { id: String(sessionId) },
    include: { order: true },
  });

  if (!session) {
    return { ok: false, err: { status: 400, error: "Session required" } };
  }

  if (session.orderId) {
    if (!session.order) {
      return { ok: false, err: { status: 500, error: "Could not load order" } };
    }
    return { ok: "idempotent", orderId: session.orderId, status: session.order.status };
  }

  if (session.status === "CONVERTED") {
    return {
      ok: false,
      err: { status: 400, error: "Order already submitted for this session" },
    };
  }
  if (session.status !== "ACTIVE") {
    return { ok: false, err: { status: 400, error: "Session is not active" } };
  }
  if (session.expiresAt <= now) {
    return { ok: false, err: { status: 400, error: "Session expired" } };
  }

  if (!selectionComplete(session)) {
    return {
      ok: false,
      err: { status: 400, error: "Complete shape and pricing before checkout" },
    };
  }

  const sessionImages = await prisma.sessionImage.findMany({
    where: { sessionId: String(session.id), status: "UPLOADED" },
    orderBy: SESSION_IMAGE_LIST_ORDER_BY,
  });

  if (sessionImages.length === 0) {
    return { ok: false, err: { status: 400, error: "No images to order" } };
  }

  for (const img of sessionImages) {
    if (
      img.cropX == null ||
      img.cropY == null ||
      img.cropWidth == null ||
      img.cropHeight == null ||
      img.cropWidth < 1 ||
      img.cropHeight < 1
    ) {
      return {
        ok: false,
        err: { status: 400, error: "All images must be cropped before checkout" },
      };
    }
  }

  let organizationId: string;
  if (session.contextType === "EVENT") {
    const event = await prisma.event.findFirst({
      where: { id: String(session.contextId), deletedAt: null },
      select: { userId: true },
    });
    if (!event) {
      return { ok: false, err: { status: 400, error: "Event not found" } };
    }
    organizationId = event.userId;
  } else {
    const storefront = await prisma.storefront.findFirst({
      where: { id: String(session.contextId), deletedAt: null },
      select: { userId: true },
    });
    if (!storefront) {
      return { ok: false, err: { status: 400, error: "Storefront not found" } };
    }
    organizationId = storefront.userId;
  }

  const pricingRow = await prisma.pricing.findFirst({
    where: {
      contextType: session.contextType,
      contextId: String(session.contextId),
      deletedAt: null,
    },
    orderBy: { displayOrder: "asc" },
  });
  const currency = pricingRow?.currency ?? "EUR";

  const copiesBySessionImageId = new Map<string, number>();
  let commitTotalPrice: Prisma.Decimal | string | number = session.totalPrice!;
  let commitOrderQuantity: number | null = session.quantity ?? null;

  if (session.pricingType === "PER_ITEM") {
    const parsed = parseImageCopiesPayload(body);
    if (!parsed) {
      return {
        ok: false,
        err: {
          status: 400,
          error:
            "imageCopies is required: an array of { imageId, copies } for each uploaded image",
        },
      };
    }
    const idSet = new Set(sessionImages.map((i) => i.id));
    if (parsed.length !== sessionImages.length) {
      return {
        ok: false,
        err: { status: 400, error: "imageCopies must list each uploaded image exactly once" },
      };
    }
    const seen = new Set<string>();
    let sumCopies = 0;
    for (const row of parsed) {
      if (!idSet.has(row.imageId) || seen.has(row.imageId)) {
        return { ok: false, err: { status: 400, error: "Invalid imageCopies entries" } };
      }
      seen.add(row.imageId);
      copiesBySessionImageId.set(row.imageId, row.copies);
      sumCopies += row.copies;
    }
    if (seen.size !== sessionImages.length) {
      return {
        ok: false,
        err: { status: 400, error: "imageCopies must list each uploaded image exactly once" },
      };
    }
    const effectiveMax = await getPerItemEffectiveMaxMagnetsPerOrder(session);
    if (sumCopies > effectiveMax) {
      return {
        ok: false,
        err: { status: 400, error: `Total magnets (${sumCopies}) cannot exceed ${effectiveMax}` },
      };
    }
    const perItemRow = await prisma.pricing.findFirst({
      where: {
        contextType: session.contextType,
        contextId: String(session.contextId),
        type: "PER_ITEM",
        deletedAt: null,
      },
    });
    if (!perItemRow) {
      return { ok: false, err: { status: 500, error: "Per-item pricing is not configured" } };
    }
    const unit = Number(perItemRow.price);
    commitTotalPrice = roundMoney2(unit * sumCopies);
    commitOrderQuantity = sumCopies;
  }

  const orderImageStorageKind =
    sessionImages.length > 0
      ? orderImageStorageKindFromSessionUrl(sessionImages[0].originalUrl)
      : "local";

  const resolvedOrderStatus: OrderCommitStatus =
    orderStatus ??
    (session.contextType === "EVENT" ? "PENDING_CASH" : "PENDING_PAYMENT");

  return {
    ok: true,
    prepared: {
      session,
      sessionRowId: String(session.id),
      now,
      organizationId,
      currency,
      orderStatus: resolvedOrderStatus,
      sessionImages,
      copiesBySessionImageId,
      commitTotalPrice,
      commitOrderQuantity,
      orderImageStorageKind,
    },
  };
}

/**
 * Enforce org limits (call before transaction).
 */
export async function checkOrgOrderLimit(organizationId: string): Promise<PrepareCommitError | null> {
  try {
    await assertCanCreateOrder(String(organizationId));
  } catch (err) {
    if (err instanceof Error && err.message === ORDER_LIMIT_REACHED) {
      return {
        status: 403,
        code: "ORDER_LIMIT_REACHED",
        error: "ORDER_LIMIT_REACHED",
        message: "Free plan limit reached. Upgrade to continue.",
      };
    }
    if (err instanceof Error && err.message === "Organization not found") {
      return { status: 500, error: "Server configuration error" };
    }
    throw err;
  }
  return null;
}

export type CommitResult =
  | { kind: "IDEMPOTENT"; orderId: string; status: OrderCommitStatus; imageCount: number }
  | { kind: "CREATED"; orderId: string; status: OrderCommitStatus; imageCount: number };

/** When set, order is created already PAID with Stripe ids (session-first webhook). */
export type CommitOrderPaidStripeIds = {
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
};

export function toOrderCustomerInsertFromValidated(
  data: ValidatedCustomerPayload,
): OrderCustomerInsert {
  return {
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    shippingType: data.shippingType,
    shippingAddress:
      data.shippingAddress === null
        ? null
        : (data.shippingAddress as Prisma.InputJsonValue),
  };
}

/**
 * Create Order + OrderImages and convert session. Idempotent if orderId set under lock.
 */
export async function runOrderCommitTransaction(
  prepared: PreparedOrderCommit,
  customer: OrderCustomerInsert,
  paidStripe: CommitOrderPaidStripeIds | null = null,
): Promise<CommitResult> {
  const {
    sessionRowId,
    now,
    organizationId,
    currency,
    orderStatus,
    sessionImages,
    copiesBySessionImageId,
    commitTotalPrice,
    commitOrderQuantity,
  } = prepared;
  const effectiveOrderStatus: OrderCommitStatus = paidStripe ? "PAID" : orderStatus;

  /**
   * DB work only: Stripe (expire) must not run inside this callback — it runs after
   * `$transaction` resolves so `OrderSession` / `Order` row locks are released first.
   */
  const { commit: result, checkoutSessionIdToExpire } = await prisma.$transaction(
    async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT id FROM "OrderSession" WHERE id = $1 FOR UPDATE`,
      sessionRowId,
    );

    const locked = await tx.orderSession.findUnique({
      where: { id: sessionRowId },
      include: { order: true },
    });
    if (!locked) {
      throw new Error("SESSION_MISSING_AFTER_LOCK");
    }
    if (locked.orderId) {
      const orderRow =
        locked.order ??
        (await tx.order.findUnique({ where: { id: String(locked.orderId) } }));
      if (orderRow) {
        return {
          commit: {
            kind: "IDEMPOTENT" as const,
            orderId: locked.orderId,
            status: orderRow.status,
            imageCount: 0,
          },
          checkoutSessionIdToExpire: null,
        };
      }
      throw new Error("ORDER_REFERENCE_MISSING");
    }
    if (locked.status === "CONVERTED" && !locked.orderId) {
      throw new Error("SESSION_INCONSISTENT");
    }

    const beforeCreate = await tx.orderSession.findUnique({
      where: { id: sessionRowId },
      include: { order: true },
    });
    if (!beforeCreate) {
      throw new Error("SESSION_MISSING_AFTER_LOCK");
    }
    if (beforeCreate.orderId) {
      const orderRow =
        beforeCreate.order ??
        (await tx.order.findUnique({ where: { id: String(beforeCreate.orderId) } }));
      if (orderRow) {
        return {
          commit: {
            kind: "IDEMPOTENT" as const,
            orderId: beforeCreate.orderId,
            status: orderRow.status,
            imageCount: 0,
          },
          checkoutSessionIdToExpire: null,
        };
      }
      throw new Error("ORDER_REFERENCE_MISSING");
    }
    if (beforeCreate.status === "CONVERTED" && !beforeCreate.orderId) {
      throw new Error("SESSION_INCONSISTENT");
    }

    const orderId = randomUUID();
    const paymentStatus: Prisma.OrderCreateInput["paymentStatus"] =
      paidStripe != null
        ? "PAID"
        : effectiveOrderStatus === "PENDING_CASH"
          ? "CASH"
          : "PENDING";

    const orderCreate: Prisma.OrderCreateInput = {
      id: orderId,
      organization: { connect: { id: String(organizationId) } },
      contextType: locked.contextType,
      contextId: String(locked.contextId),
      status: effectiveOrderStatus,
      paymentStatus,
      totalPrice: commitTotalPrice,
      currency,
      pricingType: locked.pricingType!,
      quantity: commitOrderQuantity,
      bundleId: locked.bundleId != null ? String(locked.bundleId) : null,
      customerName: customer?.customerName ?? null,
      customerPhone: customer?.customerPhone ?? null,
      shippingType: customer?.shippingType ?? null,
      shippingAddress:
        customer == null
          ? Prisma.JsonNull
          : customer.shippingAddress === null
            ? Prisma.JsonNull
            : (customer.shippingAddress as Prisma.InputJsonValue),
      ...(paidStripe
        ? {
            stripeCheckoutSessionId: paidStripe.stripeCheckoutSessionId,
            stripePaymentIntentId: paidStripe.stripePaymentIntentId,
            stripeChargeId: paidStripe.stripeChargeId,
          }
        : {}),
    };
    await tx.order.create({ data: orderCreate });

    const orderImageRows = [];
    for (const img of sessionImages) {
      const orderImageId = randomUUID();
      const copiedUrl = await copySessionImageToOrder({
        sessionImageUrl: img.originalUrl,
        orderId,
        imageId: orderImageId,
      });
      const lineCopies =
        locked.pricingType === "PER_ITEM" ? (copiesBySessionImageId.get(img.id) ?? 1) : 1;
      orderImageRows.push({
        id: orderImageId,
        orderId,
        shapeId: String(locked.selectedShapeId),
        originalUrl: copiedUrl,
        croppedUrl: null,
        cropX: img.cropX!,
        cropY: img.cropY!,
        cropWidth: img.cropWidth!,
        cropHeight: img.cropHeight!,
        rotation: 0,
        width: img.width,
        height: img.height,
        position: img.position,
        copies: lineCopies,
      });
    }

    await tx.orderImage.createMany({ data: orderImageRows });

    await tx.orderSession.update({
      where: { id: sessionRowId },
      data: {
        status: "CONVERTED",
        checkoutStage: "COMPLETED",
        lastActiveAt: now,
        /** Prevent reuse: no further Stripe checkout from this row; same atomic tx as order. */
        stripeCheckoutSessionId: null,
        /** Cookie/session row is not valid for a new cart after conversion. */
        expiresAt: now,
        orderId,
      },
    });

    await tx.organization.update({
      where: { id: String(organizationId) },
      data: { ordersThisMonth: { increment: 1 } },
    });

    return {
      commit: {
        kind: "CREATED" as const,
        orderId,
        status: effectiveOrderStatus,
        imageCount: sessionImages.length,
      },
      /** Snapshot before clearing on `OrderSession`; used only after the transaction commits. */
      checkoutSessionIdToExpire: beforeCreate.stripeCheckoutSessionId,
    };
  },
  );

  if (result.kind === "CREATED" && checkoutSessionIdToExpire) {
    await expireOrderSessionOpenStripeCheckout(
      getStripeOrNull(),
      sessionRowId,
      checkoutSessionIdToExpire,
    );
  }

  return result;
}

/** Map finalize payment method + context to order row status. */
export function resolveOrderStatusForFinalization(
  contextType: "EVENT" | "STOREFRONT",
  paymentMethod: string,
): OrderCommitStatus | null {
  const pm = String(paymentMethod).trim().toLowerCase();
  if (contextType === "STOREFRONT") {
    if (pm === "stripe") return "PENDING_PAYMENT";
    return null;
  }
  if (contextType === "EVENT") {
    if (pm === "cash" || pm === "card_on_location" || pm === "card on location")
      return "PENDING_CASH";
    if (pm === "stripe") return "PENDING_PAYMENT";
  }
  return null;
}
