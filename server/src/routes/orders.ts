/**
 * POST /api/orders — commit OrderSession → Order + OrderImage (Phase 5F).
 * Idempotent: repeats return the same { orderId, status } once orderId is set on the session.
 */
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { Router } from "express";
import type { OrderCommitStatus } from "../../../src/generated/prisma/client";
import { Prisma } from "../../../src/generated/prisma/client";
import { prisma } from "../lib/prisma";
import { sessionConfig } from "../config/session";
import { authConfig } from "../config/auth";
import { verifyToken, type JwtPayload } from "../lib/auth";
import { authenticate, requireRole } from "../middleware/auth";
import { clearSessionCookie } from "../lib/orderSessionApi";
import {
  ORDER_IMAGE_LIST_ORDER_BY,
  SESSION_IMAGE_LIST_ORDER_BY,
} from "../lib/magnetImageOrderBy";
import {
  copySessionImageToOrder,
  orderImageStorageKindFromSessionUrl,
} from "../lib/orderImageStorage";
import { validateOrderCustomerBody } from "../lib/orderCustomerValidation";
import {
  expandOrderImagesForPrintSheet,
  generatePrintSheet,
} from "../lib/generatePrintSheet";
import { getPerItemEffectiveMaxMagnetsPerOrder } from "../lib/maxMagnetsPerOrder";
import { renderOrderImages } from "../lib/renderOrderImages";
import {
  buildOrderEmailHtml,
  buildOrderEmailSubject,
  sendNewOrderEmail,
} from "../lib/email";
import { loadOrderNotificationContext } from "../lib/orderNotificationContext";
import { assertCanCreateOrder, ORDER_LIMIT_REACHED } from "../lib/saas";

export const ordersRouter = Router();

/** Same rule as seller UI: printable now (paid online or event cash). */
function isReadyToPrintForSeller(status: string): boolean {
  return status === "PAID" || status === "PENDING_CASH";
}

/** Computed for seller list/detail — not stored in DB. */
function getDisplayStatus(order: {
  status: string;
  printedAt: Date | null;
  shippedAt: Date | null;
}):
  | "SHIPPED"
  | "PRINTED"
  | "READY_TO_PRINT"
  | "AWAITING_PAYMENT"
  | "UNKNOWN" {
  if (order.shippedAt) return "SHIPPED";
  if (order.printedAt) return "PRINTED";
  if (order.status === "PAID" || order.status === "PENDING_CASH") {
    return "READY_TO_PRINT";
  }
  if (order.status === "PENDING_PAYMENT") {
    return "AWAITING_PAYMENT";
  }
  return "UNKNOWN";
}

/** List UI filter — matches seller orders table (shipped → print progress). */
function deriveSellerListStatusKey(o: {
  shippedAt: Date | null;
  orderImages: { printed: boolean }[];
}): "ready" | "partial" | "printed" | "shipped" {
  if (o.shippedAt) return "shipped";
  const total = o.orderImages.length;
  const printed = o.orderImages.filter((img) => img.printed).length;
  if (printed === 0) return "ready";
  if (printed < total) return "partial";
  return "printed";
}

const LIST_STATUS_SORT_PRIORITY: Record<
  "ready" | "partial" | "printed" | "shipped",
  number
> = {
  ready: 1,
  partial: 2,
  printed: 3,
  shipped: 4,
};

function parsePositiveInt(value: unknown, fallback: number): number {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

/** GET /api/orders — seller list with search, filters, pagination (derived status filtered in memory). */
ordersRouter.get(
  "/",
  authenticate,
  requireRole("ADMIN", "STAFF"),
  async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    const page = parsePositiveInt(req.query.page, 1);
    const pageSizeRaw = parsePositiveInt(req.query.pageSize, 20);
    const pageSize = Math.min(100, Math.max(1, pageSizeRaw));

    const searchRaw =
      typeof req.query.search === "string" ? req.query.search.trim() : "";
    const statusRaw =
      typeof req.query.status === "string" ? req.query.status.trim().toLowerCase() : "";
    const allowedStatus = new Set(["ready", "partial", "printed", "shipped"]);
    const statusFilter =
      statusRaw && allowedStatus.has(statusRaw) ? statusRaw : "";

    let createdAt: { gte?: Date; lte?: Date } | undefined;
    const dateFrom =
      typeof req.query.dateFrom === "string" ? req.query.dateFrom.trim() : "";
    const dateTo =
      typeof req.query.dateTo === "string" ? req.query.dateTo.trim() : "";
    const dateRange =
      typeof req.query.dateRange === "string" ? req.query.dateRange.trim() : "";

    if (dateFrom || dateTo) {
      const range: { gte?: Date; lte?: Date } = {};
      if (dateFrom) {
        const d = new Date(dateFrom);
        if (!Number.isNaN(d.getTime())) range.gte = d;
      }
      if (dateTo) {
        const d = new Date(dateTo);
        if (!Number.isNaN(d.getTime())) {
          d.setHours(23, 59, 59, 999);
          range.lte = d;
        }
      }
      if (range.gte || range.lte) createdAt = range;
    } else if (dateRange.includes(",")) {
      const [a, b] = dateRange.split(",").map((s) => s.trim());
      const start = a ? new Date(a) : null;
      const end = b ? new Date(b) : null;
      if (start && !Number.isNaN(start.getTime())) {
        const range: { gte?: Date; lte?: Date } = { gte: start };
        if (end && !Number.isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          range.lte = end;
        }
        createdAt = range;
      }
    }

    const where: {
      organizationId: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = {
      organizationId: userId,
      ...(createdAt ? { createdAt } : {}),
    };

    const orders = await prisma.order.findMany({
      where,
      select: {
        id: true,
        shortCode: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        status: true,
        printedAt: true,
        shippedAt: true,
        contextType: true,
        totalPrice: true,
        currency: true,
        createdAt: true,
        orderImages: {
          select: { printed: true },
        },
      },
    });

    let filtered = orders;

    if (searchRaw.length > 0) {
      const q = searchRaw.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          (o.shortCode?.toLowerCase().includes(q) ?? false) ||
          (o.customerName?.toLowerCase().includes(q) ?? false) ||
          (o.customerEmail?.toLowerCase().includes(q) ?? false) ||
          (o.customerPhone?.toLowerCase().includes(q) ?? false),
      );
    }

    const sortByParam =
      typeof req.query.sortBy === "string" ? req.query.sortBy.trim() : "";
    const sortBy = sortByParam === "status" ? "status" : "createdAt";
    const sortOrderRaw =
      typeof req.query.sortOrder === "string"
        ? req.query.sortOrder.trim().toLowerCase()
        : "";
    const sortOrder = sortOrderRaw === "asc" ? "asc" : "desc";

    const withDerived = filtered.map((o) => {
      const totalImages = o.orderImages.length;
      const printedImages = o.orderImages.filter((img) => img.printed).length;
      const listStatus = deriveSellerListStatusKey(o);
      return {
        row: o,
        listStatus,
        payload: {
          id: o.id,
          shortCode: o.shortCode,
          customerName: o.customerName,
          customerEmail: o.customerEmail,
          customerPhone: o.customerPhone,
          status: o.status,
          displayStatus: getDisplayStatus(o),
          contextType: o.contextType,
          totalPrice: o.totalPrice.toString(),
          currency: o.currency,
          createdAt: o.createdAt.toISOString(),
          imageCount: totalImages,
          totalImages,
          printedImages,
        },
      };
    });

    const statusFiltered = statusFilter
      ? withDerived.filter((x) => x.listStatus === statusFilter)
      : withDerived;

    const sortedList = [...statusFiltered].sort((x, y) => {
      if (sortBy === "createdAt") {
        const ta = x.row.createdAt.getTime();
        const tb = y.row.createdAt.getTime();
        const cmp = sortOrder === "asc" ? ta - tb : tb - ta;
        if (cmp !== 0) return cmp;
        return x.row.id.localeCompare(y.row.id);
      }
      const pa = LIST_STATUS_SORT_PRIORITY[x.listStatus];
      const pb = LIST_STATUS_SORT_PRIORITY[y.listStatus];
      const cmp = sortOrder === "asc" ? pa - pb : pb - pa;
      if (cmp !== 0) return cmp;
      return y.row.createdAt.getTime() - x.row.createdAt.getTime();
    });

    // Pagination totals = full filtered+sorted count (never the current page length).
    const total = sortedList.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    // Clamp requested page when filters/sort shrink results (e.g. page=5 but only 1 page left).
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * pageSize;
    const pageItems = sortedList
      .slice(skip, skip + pageSize)
      .map((x) => x.payload);

    res.json({
      items: pageItems,
      pagination: {
        page: safePage,
        pageSize,
        total,
        totalPages,
      },
    });
  },
);

/**
 * POST /api/orders/:id/print-preview — generate PDF(s) only; does not set printed flags.
 */
ordersRouter.post(
  "/:id/print-preview",
  authenticate,
  requireRole("ADMIN", "STAFF"),
  async (req: Request, res: Response) => {
    const orderId = String(req.params.id ?? "").trim();
    if (!orderId) {
      res.status(400).json({ error: "Order id required" });
      return;
    }
    const owner = req.user!.userId;
    const order = await prisma.order.findFirst({
      where: { id: orderId, organizationId: owner },
      include: {
        orderImages: { orderBy: ORDER_IMAGE_LIST_ORDER_BY },
      },
    });
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (!isReadyToPrintForSeller(order.status)) {
      res.status(400).json({
        error: "Order must be paid before printing",
      });
      return;
    }
    if (order.orderImages.length === 0) {
      res.status(400).json({ error: "No images to print" });
      return;
    }

    try {
      await renderOrderImages(
        orderId,
        order.orderImages.map((img) => ({
          id: img.id,
          originalUrl: img.originalUrl,
          cropX: img.cropX,
          cropY: img.cropY,
          cropWidth: img.cropWidth,
          cropHeight: img.cropHeight,
        })),
      );
    } catch (renderErr) {
      console.warn("[print-preview] renderOrderImages", renderErr);
    }

    const refreshed = await prisma.orderImage.findMany({
      where: { orderId },
      orderBy: ORDER_IMAGE_LIST_ORDER_BY,
    });
    const grouped: Record<string, typeof refreshed> = {};
    for (const img of refreshed) {
      if (!grouped[img.shapeId]) grouped[img.shapeId] = [];
      grouped[img.shapeId]!.push(img);
    }

    const urls: string[] = [];
    for (const shapeId of Object.keys(grouped)) {
      const imgs = grouped[shapeId];
      if (!imgs?.length) continue;
      const pdfUrl = await generatePrintSheet(
        orderId,
        expandOrderImagesForPrintSheet(
          imgs.map((img) => ({
            id: img.id,
            renderedUrl: img.renderedUrl,
            copies: img.copies,
          })),
        ),
        shapeId,
      );
      urls.push(pdfUrl);
    }

    const first = urls[0] ?? null;
    res.json({
      url: first,
      urls,
    });
  },
);

/**
 * POST /api/orders/:id/print-selected — PDFs for chosen images only; marks those rows printed.
 */
ordersRouter.post(
  "/:id/print-selected",
  authenticate,
  requireRole("ADMIN", "STAFF"),
  async (req: Request, res: Response) => {
    const orderId = String(req.params.id ?? "").trim();
    if (!orderId) {
      res.status(400).json({ error: "Order id required" });
      return;
    }
    const owner = req.user!.userId;

    const body = req.body as { imageIds?: unknown };
    if (!Array.isArray(body.imageIds) || body.imageIds.length === 0) {
      res.status(400).json({ error: "imageIds must be a non-empty array" });
      return;
    }
    const raw = body.imageIds as unknown[];
    const imageIds = [
      ...new Set(
        raw
          .map((x) => (typeof x === "string" ? x.trim() : ""))
          .filter((s) => s.length > 0),
      ),
    ];
    if (imageIds.length === 0) {
      res.status(400).json({ error: "imageIds must be non-empty strings" });
      return;
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, organizationId: owner },
      select: { id: true, status: true },
    });
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (!isReadyToPrintForSeller(order.status)) {
      res.status(400).json({
        error: "Order must be paid before printing",
      });
      return;
    }

    const images = await prisma.orderImage.findMany({
      where: { orderId, id: { in: imageIds } },
      orderBy: ORDER_IMAGE_LIST_ORDER_BY,
    });
    if (images.length !== imageIds.length) {
      res.status(400).json({
        error: "One or more images not found on this order",
      });
      return;
    }

    try {
      await renderOrderImages(
        orderId,
        images.map((img) => ({
          id: img.id,
          originalUrl: img.originalUrl,
          cropX: img.cropX,
          cropY: img.cropY,
          cropWidth: img.cropWidth,
          cropHeight: img.cropHeight,
        })),
      );
    } catch (renderErr) {
      console.warn("[print-selected] renderOrderImages", renderErr);
    }

    const refreshed = await prisma.orderImage.findMany({
      where: { orderId, id: { in: imageIds } },
      orderBy: ORDER_IMAGE_LIST_ORDER_BY,
    });

    const grouped: Record<string, typeof refreshed> = {};
    for (const img of refreshed) {
      if (!grouped[img.shapeId]) grouped[img.shapeId] = [];
      grouped[img.shapeId]!.push(img);
    }

    const urls: string[] = [];
    for (const shapeId of Object.keys(grouped)) {
      const groupImages = grouped[shapeId];
      if (!groupImages?.length) continue;
      const pdfUrl = await generatePrintSheet(
        orderId,
        expandOrderImagesForPrintSheet(
          groupImages.map((img) => ({
            id: img.id,
            renderedUrl: img.renderedUrl,
            copies: img.copies,
          })),
        ),
        shapeId,
      );
      urls.push(pdfUrl);
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.orderImage.updateMany({
        where: { orderId, id: { in: imageIds }, printed: false },
        data: { printed: true, printedAt: now },
      });
      const unprinted = await tx.orderImage.count({
        where: { orderId, printed: false },
      });
      if (unprinted === 0) {
        await tx.order.update({
          where: { id: orderId },
          data: { printedAt: now },
        });
      }
    });

    res.json({ urls });
  },
);

/**
 * PATCH /api/orders/:id/mark-printed
 * Body (optional): { imageIds?: string[] } — if non-empty, only those rows; else all images.
 * Sets order.printedAt when every OrderImage has printed=true after the update.
 */
ordersRouter.patch(
  "/:id/mark-printed",
  authenticate,
  requireRole("ADMIN", "STAFF"),
  async (req: Request, res: Response) => {
    const orderId = String(req.params.id ?? "").trim();
    if (!orderId) {
      res.status(400).json({ error: "Order id required" });
      return;
    }
    const owner = req.user!.userId;
    const existing = await prisma.order.findFirst({
      where: { id: orderId, organizationId: owner },
      include: {
        _count: { select: { orderImages: true } },
      },
    });
    if (!existing) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (!isReadyToPrintForSeller(existing.status)) {
      res.status(400).json({
        error: "Order must be paid before marking as printed",
      });
      return;
    }
    if (existing._count.orderImages === 0) {
      res.status(400).json({ error: "No images to mark as printed" });
      return;
    }

    const body = req.body as { imageIds?: unknown };
    let imageIdList: string[] | null = null;
    if (body?.imageIds !== undefined && body?.imageIds !== null) {
      if (!Array.isArray(body.imageIds)) {
        res.status(400).json({ error: "imageIds must be an array" });
        return;
      }
      if (body.imageIds.length > 0) {
        const raw = body.imageIds as unknown[];
        const ids = raw
          .map((x) => (typeof x === "string" ? x.trim() : ""))
          .filter((s) => s.length > 0);
        if (ids.length !== raw.length) {
          res.status(400).json({ error: "imageIds must be non-empty strings" });
          return;
        }
        imageIdList = [...new Set(ids)];
      }
    }

    if (imageIdList && imageIdList.length > 0) {
      const found = await prisma.orderImage.findMany({
        where: { orderId, id: { in: imageIdList } },
        select: { id: true },
      });
      if (found.length !== imageIdList.length) {
        res.status(400).json({
          error: "One or more images not found on this order",
        });
        return;
      }
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      if (imageIdList && imageIdList.length > 0) {
        await tx.orderImage.updateMany({
          where: { orderId, id: { in: imageIdList }, printed: false },
          data: { printed: true, printedAt: now },
        });
      } else {
        await tx.orderImage.updateMany({
          where: { orderId, printed: false },
          data: { printed: true, printedAt: now },
        });
      }

      const unprinted = await tx.orderImage.count({
        where: { orderId, printed: false },
      });
      if (unprinted === 0) {
        await tx.order.update({
          where: { id: orderId },
          data: { printedAt: now },
        });
      }
    });

    const orderRow = await prisma.order.findUnique({
      where: { id: orderId },
      select: { printedAt: true },
    });
    const allImagesPrinted =
      (await prisma.orderImage.count({
        where: { orderId, printed: false },
      })) === 0;

    res.json({
      ok: true,
      printedAt: orderRow?.printedAt?.toISOString() ?? null,
      allImagesPrinted,
    });
  },
);

/** PATCH /api/orders/:id/ship — seller: mark order shipped (requires printed first). */
ordersRouter.patch(
  "/:id/ship",
  authenticate,
  requireRole("ADMIN", "STAFF"),
  async (req: Request, res: Response) => {
    const orderId = String(req.params.id ?? "").trim();
    if (!orderId) {
      res.status(400).json({ error: "Order id required" });
      return;
    }
    const owner = req.user!.userId;
    const existing = await prisma.order.findFirst({
      where: { id: orderId, organizationId: owner },
      select: { id: true, printedAt: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (!existing.printedAt) {
      res.status(400).json({ error: "Mark as printed before shipping" });
      return;
    }
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { shippedAt: new Date() },
      select: { shippedAt: true },
    });
    res.json({
      shippedAt: updated.shippedAt!.toISOString(),
    });
  },
);

/**
 * PATCH /api/orders/:id/customer — customer fields only (name / phone / shipping).
 * - Buyer: order session cookie (same as checkout).
 * - Seller: auth cookie (JWT), order must belong to org (ADMIN/STAFF).
 * Allowed at any order status, including PAID (no price/images/shape via this route).
 */
ordersRouter.patch("/:id/customer", async (req: Request, res: Response) => {
  const orderId = String(req.params.id ?? "").trim();
  if (!orderId) {
    res.status(400).json({ error: "Order id required" });
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  let authorized = false;

  const cookieSessionId = req.cookies?.[sessionConfig.cookieName] as
    | string
    | undefined;
  if (cookieSessionId) {
    const orderSession = await prisma.orderSession.findUnique({
      where: { id: String(cookieSessionId) },
    });
    if (orderSession?.orderId === orderId) {
      authorized = true;
    }
  }

  if (!authorized) {
    const authToken = req.cookies?.[authConfig.cookieName] as string | undefined;
    if (authToken) {
      try {
        const user = verifyToken(authToken);
        if (
          (user.role === "ADMIN" || user.role === "STAFF") &&
          user.userId === order.organizationId
        ) {
          authorized = true;
        }
      } catch {
        /* invalid token */
      }
    }
  }

  if (!authorized) {
    res.status(403).json({ error: "Not allowed to update this order" });
    return;
  }

  const parsed = validateOrderCustomerBody(order.contextType, req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { data } = parsed;

  await prisma.order.update({
    where: { id: orderId },
    data: {
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      shippingType: data.shippingType,
      shippingAddress:
        data.shippingAddress === null
          ? Prisma.DbNull
          : (data.shippingAddress as Prisma.InputJsonValue),
    },
  });

  try {
    const orderFull = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderImages: true,
      },
    });

    if (orderFull) {
      const { contextName, sendOrderEmails, notificationEmail } =
        await loadOrderNotificationContext(orderFull);

      if (sendOrderEmails && notificationEmail) {
        await sendNewOrderEmail({
          to: notificationEmail,
          subject: buildOrderEmailSubject(orderFull, contextName),
          html: buildOrderEmailHtml(orderFull, contextName),
        });
      }
    }
  } catch (err) {
    console.error("[email] failed after customer step", err);
  }

  res.json({ ok: true });
});

type ImageCopyPayload = { imageId: string; copies: number };

function parseImageCopiesPayload(body: unknown): ImageCopyPayload[] | null {
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

function roundMoney2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

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
      select: { userId: true },
    });
    if (!event) {
      res.status(400).json({ error: "Event not found" });
      return;
    }
    organizationId = event.userId;
  } else {
    const storefront = await prisma.storefront.findFirst({
      where: { id: String(session.contextId), deletedAt: null },
      select: { userId: true },
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

  const copiesBySessionImageId = new Map<string, number>();
  let commitTotalPrice: Prisma.Decimal | string | number = session.totalPrice!;
  let commitOrderQuantity: number | null = session.quantity ?? null;

  if (session.pricingType === "PER_ITEM") {
    const parsed = parseImageCopiesPayload(req.body);
    if (!parsed) {
      res.status(400).json({
        error:
          "imageCopies is required: an array of { imageId, copies } for each uploaded image",
      });
      return;
    }
    const idSet = new Set(sessionImages.map((i) => i.id));
    if (parsed.length !== sessionImages.length) {
      res.status(400).json({
        error: "imageCopies must list each uploaded image exactly once",
      });
      return;
    }
    const seen = new Set<string>();
    let sumCopies = 0;
    for (const row of parsed) {
      if (!idSet.has(row.imageId) || seen.has(row.imageId)) {
        res.status(400).json({ error: "Invalid imageCopies entries" });
        return;
      }
      seen.add(row.imageId);
      copiesBySessionImageId.set(row.imageId, row.copies);
      sumCopies += row.copies;
    }
    if (seen.size !== sessionImages.length) {
      res.status(400).json({
        error: "imageCopies must list each uploaded image exactly once",
      });
      return;
    }
    const effectiveMax = await getPerItemEffectiveMaxMagnetsPerOrder(session);
    if (sumCopies > effectiveMax) {
      res.status(400).json({
        error: `Total magnets (${sumCopies}) cannot exceed ${effectiveMax}`,
      });
      return;
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
      res.status(500).json({ error: "Per-item pricing is not configured" });
      return;
    }
    const unit = Number(perItemRow.price);
    commitTotalPrice = roundMoney2(unit * sumCopies);
    commitOrderQuantity = sumCopies;
  }

  const orderImageStorageKind =
    sessionImages.length > 0
      ? orderImageStorageKindFromSessionUrl(sessionImages[0].originalUrl)
      : "local";

  try {
    await assertCanCreateOrder(String(organizationId));
  } catch (err) {
    if (err instanceof Error && err.message === ORDER_LIMIT_REACHED) {
      res.status(403).json({
        code: "ORDER_LIMIT_REACHED",
        message: "Free plan limit reached. Upgrade to continue.",
      });
      return;
    }
    if (err instanceof Error && err.message === "Organization not found") {
      res.status(500).json({ error: "Server configuration error" });
      return;
    }
    throw err;
  }

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
          totalPrice: commitTotalPrice,
          currency,
          pricingType: locked.pricingType!,
          quantity: commitOrderQuantity,
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
        const lineCopies =
          locked.pricingType === "PER_ITEM"
            ? (copiesBySessionImageId.get(img.id) ?? 1)
            : 1;
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

      await tx.organization.update({
        where: { id: String(organizationId) },
        data: {
          ordersThisMonth: { increment: 1 },
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

/**
 * GET /api/orders/:id
 * - Seller (auth cookie): full order + images + print sheet URLs (same origin paths).
 * - Customer (session cookie): payment status for Stripe success polling.
 */
ordersRouter.get("/:id", async (req: Request, res: Response) => {
  const orderId = String(req.params.id ?? "").trim();
  if (!orderId) {
    res.status(400).json({ error: "Order id required" });
    return;
  }

  const token = req.cookies?.[authConfig.cookieName] as string | undefined;
  let sellerUser: JwtPayload | null = null;
  if (token) {
    try {
      sellerUser = verifyToken(token);
    } catch {
      sellerUser = null;
    }
  }

  if (sellerUser) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, organizationId: sellerUser.userId },
      include: {
        orderImages: { orderBy: ORDER_IMAGE_LIST_ORDER_BY },
      },
    });
    if (order) {
      const shapeIds = [...new Set(order.orderImages.map((i) => i.shapeId))];
      const shapes = await prisma.allowedShape.findMany({
        where: { id: { in: shapeIds } },
        select: { id: true, widthMm: true, heightMm: true },
      });
      const shapeById = new Map(shapes.map((s) => [s.id, s]));
      const printSheets = shapeIds.map((sid) => {
        const sh = shapeById.get(sid);
        return {
          url: `/uploads/print-sheets/${order.id}-${sid}.pdf`,
          widthMm: sh?.widthMm ?? 0,
          heightMm: sh?.heightMm ?? 0,
        };
      });
      res.json({
        orderId: order.id,
        status: order.status,
        displayStatus: getDisplayStatus(order),
        contextType: order.contextType,
        contextId: order.contextId,
        totalPrice: order.totalPrice.toString(),
        currency: order.currency,
        imageCount: order.orderImages.length,
        createdAt: order.createdAt.toISOString(),
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        shippingType: order.shippingType,
        shippingAddress: order.shippingAddress,
        printedAt: order.printedAt?.toISOString() ?? null,
        shippedAt: order.shippedAt?.toISOString() ?? null,
        images: order.orderImages.map((img) => ({
          id: img.id,
          renderedUrl: img.renderedUrl,
          position: img.position,
          shapeId: img.shapeId,
          copies: img.copies,
          printed: img.printed,
          printedAt: img.printedAt?.toISOString() ?? null,
        })),
        printSheets,
      });
      return;
    }
    res.status(404).json({ error: "Order not found" });
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
    select: {
      id: true,
      status: true,
      contextType: true,
      contextId: true,
      customerName: true,
      customerPhone: true,
      shippingType: true,
      shippingAddress: true,
      totalPrice: true,
      currency: true,
      _count: { select: { orderImages: true } },
    },
  });

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json({
    orderId: order.id,
    status: order.status,
    contextType: order.contextType,
    contextId: order.contextId,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    shippingType: order.shippingType,
    shippingAddress: order.shippingAddress,
    totalPrice: order.totalPrice.toString(),
    currency: order.currency,
    imageCount: order._count.orderImages,
  });
});
