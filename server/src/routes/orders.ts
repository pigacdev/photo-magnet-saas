/**
 * POST /api/orders — commit OrderSession → Order + OrderImage (Phase 5F).
 * Idempotent: repeats return the same { orderId, status } once orderId is set on the session.
 */
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { Router } from "express";
import type { OrderCommitStatus } from "../../../src/generated/prisma/client";
import { prisma } from "../lib/prisma";
import { sessionConfig } from "../config/session";
import { clearSessionCookie } from "../lib/orderSessionApi";
import { SESSION_IMAGE_LIST_ORDER_BY } from "../lib/magnetImageOrderBy";
import {
  copySessionImageToOrder,
  orderImageStorageKindFromSessionUrl,
} from "../lib/orderImageStorage";

export const ordersRouter = Router();

function selectionComplete(session: {
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

ordersRouter.post("/", async (req: Request, res: Response) => {
  const sessionId = req.cookies?.[sessionConfig.cookieName] as string | undefined;
  if (!sessionId) {
    res.status(400).json({ error: "Session required" });
    return;
  }

  const session = await prisma.orderSession.findUnique({
    where: { id: String(sessionId) },
    include: { order: true },
  });

  if (!session) {
    clearSessionCookie(res);
    res.status(400).json({ error: "Session required" });
    return;
  }

  const now = new Date();

  if (session.orderId) {
    if (!session.order) {
      res.status(500).json({ error: "Could not load order" });
      return;
    }
    console.info("[order.commit] idempotent", {
      sessionId: session.id,
      orderId: session.orderId,
      status: session.order.status,
    });
    res.json({
      orderId: session.orderId,
      status: session.order.status,
    });
    return;
  }

  if (session.status === "CONVERTED") {
    res.status(400).json({
      error: "Order already submitted for this session",
    });
    return;
  }
  if (session.status !== "ACTIVE") {
    res.status(400).json({ error: "Session is not active" });
    return;
  }
  if (session.expiresAt <= now) {
    res.status(400).json({ error: "Session expired" });
    return;
  }

  if (!selectionComplete(session)) {
    res.status(400).json({ error: "Complete shape and pricing before checkout" });
    return;
  }

  const sessionImages = await prisma.sessionImage.findMany({
    where: { sessionId: String(session.id), status: "UPLOADED" },
    orderBy: SESSION_IMAGE_LIST_ORDER_BY,
  });

  if (sessionImages.length === 0) {
    res.status(400).json({ error: "No images to order" });
    return;
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
      res.status(400).json({ error: "All images must be cropped before checkout" });
      return;
    }
  }

  let organizationId: string;
  if (session.contextType === "EVENT") {
    const event = await prisma.event.findFirst({
      where: { id: String(session.contextId), deletedAt: null },
    });
    if (!event) {
      res.status(400).json({ error: "Event not found" });
      return;
    }
    organizationId = event.userId;
  } else {
    const storefront = await prisma.storefront.findFirst({
      where: { id: String(session.contextId), deletedAt: null },
    });
    if (!storefront) {
      res.status(400).json({ error: "Storefront not found" });
      return;
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

  const orderStatus: OrderCommitStatus =
    session.contextType === "EVENT" ? "PENDING_CASH" : "PENDING_PAYMENT";

  const totalPrice = session.totalPrice!;

  const orderImageStorageKind =
    sessionImages.length > 0
      ? orderImageStorageKindFromSessionUrl(sessionImages[0].originalUrl)
      : "local";

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sessionRowId = String(session.id);
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
      if (locked.orderId && locked.order) {
        return {
          kind: "IDEMPOTENT" as const,
          orderId: locked.orderId,
          status: locked.order.status,
          imageCount: 0,
        };
      }
      if (locked.status === "CONVERTED") {
        throw new Error("SESSION_INCONSISTENT");
      }

      const orderId = randomUUID();
      await tx.order.create({
        data: {
          id: orderId,
          organizationId: String(organizationId),
          contextType: session.contextType,
          contextId: String(session.contextId),
          status: orderStatus,
          totalPrice,
          currency,
          pricingType: locked.pricingType!,
          quantity: locked.quantity,
          bundleId:
            locked.bundleId != null ? String(locked.bundleId) : null,
        },
      });

      const orderImageRows = [];
      for (const img of sessionImages) {
        const orderImageId = randomUUID();
        const copiedUrl = await copySessionImageToOrder({
          sessionImageUrl: img.originalUrl,
          orderId,
          imageId: orderImageId,
        });
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
        });
      }

      await tx.orderImage.createMany({
        data: orderImageRows,
      });

      await tx.orderSession.update({
        where: { id: sessionRowId },
        data: {
          status: "CONVERTED",
          lastActiveAt: now,
          orderId,
        },
      });

      return {
        kind: "CREATED" as const,
        orderId,
        status: orderStatus,
        imageCount: sessionImages.length,
      };
    });

    if (result.kind === "IDEMPOTENT") {
      console.info("[order.commit] idempotent", {
        sessionId: session.id,
        orderId: result.orderId,
        status: result.status,
      });
    } else {
      console.info("[order.commit]", {
        sessionId: session.id,
        orderId: result.orderId,
        imageCount: result.imageCount,
        status: result.status,
        storage: orderImageStorageKind,
      });
    }

    res.json({
      orderId: result.orderId,
      status: result.status,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "SESSION_INCONSISTENT") {
      res.status(400).json({
        error: "Order already submitted for this session",
      });
      return;
    }
    console.error("[order.commit] failed", e);
    res.status(500).json({ error: "Could not create order" });
  }
});

/** GET /api/orders/:id — payment status for the current session (Stripe success polling). */
ordersRouter.get("/:id", async (req: Request, res: Response) => {
  const orderId = String(req.params.id ?? "").trim();
  if (!orderId) {
    res.status(400).json({ error: "Order id required" });
    return;
  }

  const sessionId = req.cookies?.[sessionConfig.cookieName] as string | undefined;
  if (!sessionId) {
    res.status(401).json({ error: "Session required" });
    return;
  }

  const orderSession = await prisma.orderSession.findUnique({
    where: { id: String(sessionId) },
  });
  if (!orderSession?.orderId || orderSession.orderId !== orderId) {
    res.status(403).json({ error: "Invalid order for this session" });
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true },
  });

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json({
    orderId: order.id,
    status: order.status,
  });
});
