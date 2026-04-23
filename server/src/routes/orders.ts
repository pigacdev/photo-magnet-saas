/**
 * Order routes: list/print, PATCH customer, Stripe helpers.
 * - POST /api/orders/finalize — create Order from session (preferred).
 * - POST /api/orders — deprecated; same as finalize without customer binding (legacy).
 */
import type { Request, Response } from "express";
import { Router } from "express";
import { Prisma } from "../../../src/generated/prisma/client";
import { prisma } from "../lib/prisma";
import { sessionConfig } from "../config/session";
import { authConfig } from "../config/auth";
import { verifyToken, type JwtPayload } from "../lib/auth";
import { authenticate, requireRole } from "../middleware/auth";
import { clearSessionCookie } from "../lib/orderSessionApi";
import { ORDER_IMAGE_LIST_ORDER_BY } from "../lib/magnetImageOrderBy";
import { validateOrderCustomerBody } from "../lib/orderCustomerValidation";
import {
  checkOrgOrderLimit,
  type PrepareCommitError,
  prepareOrderSessionCommit,
  resolveOrderStatusForFinalization,
  runOrderCommitTransaction,
  toOrderCustomerInsertFromValidated,
} from "../lib/orderSessionCheckoutCommit";
import { validateOrderSessionContext } from "../lib/sessionContextValidation";
import {
  expandOrderImagesForPrintSheet,
  generatePrintSheet,
} from "../lib/generatePrintSheet";
import { renderOrderImages } from "../lib/renderOrderImages";
import {
  buildOrderEmailHtml,
  buildOrderEmailSubject,
  sendNewOrderEmail,
} from "../lib/email";
import { loadOrderNotificationContext } from "../lib/orderNotificationContext";

export const ordersRouter = Router();

function sendOrderPrepareError(res: Response, err: PrepareCommitError) {
  if (err.status === 403 && err.code === "ORDER_LIMIT_REACHED") {
    res.status(403).json({
      code: err.code,
      message: err.message,
    });
    return;
  }
  res
    .status(err.status)
    .json("code" in err && err.code ? { error: err.error, code: err.code } : { error: err.error });
}

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

/**
 * POST /api/orders/finalize — only supported path to create an Order with customer details (Phase: checkout finalization).
 */
ordersRouter.post("/finalize", async (req: Request, res: Response) => {
  const sessionId = req.cookies?.[sessionConfig.cookieName] as string | undefined;
  if (!sessionId) {
    res.status(400).json({ error: "Session required" });
    return;
  }

  const sessionRow = await prisma.orderSession.findUnique({
    where: { id: String(sessionId) },
    include: { order: true },
  });
  if (!sessionRow) {
    clearSessionCookie(res);
    res.status(400).json({ error: "Session required" });
    return;
  }

  if (sessionRow.status === "CONVERTED" && sessionRow.orderId != null) {
    if (!sessionRow.order) {
      res.status(500).json({ error: "Could not load order" });
      return;
    }
    console.info("[order.finalize] idempotent", {
      sessionId: sessionRow.id,
      orderId: sessionRow.orderId,
    });
    res.json({ orderId: sessionRow.orderId, status: sessionRow.order.status });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const paymentMethod =
    typeof body.paymentMethod === "string" ? body.paymentMethod.trim() : "";
  if (!paymentMethod) {
    res.status(400).json({ error: "paymentMethod is required" });
    return;
  }

  const orderStatus = resolveOrderStatusForFinalization(
    sessionRow.contextType,
    paymentMethod,
  );
  if (!orderStatus) {
    res.status(400).json({ error: "Invalid payment method for this checkout context" });
    return;
  }

  const customerBody = {
    customerName: body.customerName,
    customerPhone:
      (typeof body.phone === "string" ? body.phone : body.customerPhone) as unknown,
    shippingType: (body.shippingMethod ?? body.shippingType) as unknown,
    shippingAddress: body.shippingAddress,
  };

  const validated = validateOrderCustomerBody(sessionRow.contextType, customerBody);
  if ("error" in validated) {
    res.status(400).json({ error: validated.error });
    return;
  }

  const now = new Date();
  const prep = await prepareOrderSessionCommit(sessionId, req.body, now, orderStatus);
  if (prep.ok === "idempotent") {
    console.info("[order.finalize] idempotent", {
      sessionId: String(sessionId),
      orderId: prep.orderId,
    });
    res.json({ orderId: prep.orderId, status: prep.status });
    return;
  }
  if (!prep.ok) {
    sendOrderPrepareError(res, prep.err);
    return;
  }

  const { prepared } = prep;
  const contextOk = await validateOrderSessionContext(
    prepared.session.contextType,
    String(prepared.session.contextId),
  );
  if (!contextOk.ok) {
    if (contextOk.notFound) {
      res.status(404).json({ error: "Context not found" });
    } else {
      res.status(400).json({ error: contextOk.reason });
    }
    return;
  }

  const limitErr = await checkOrgOrderLimit(prepared.organizationId);
  if (limitErr) {
    sendOrderPrepareError(res, limitErr);
    return;
  }

  const sessionRowId = prepared.sessionRowId;
  const stageUpdated = await prisma.orderSession.updateMany({
    where: { id: sessionRowId, status: "ACTIVE", orderId: null },
    data: { checkoutStage: "PAYMENT_PENDING", lastActiveAt: now },
  });
  if (stageUpdated.count === 0) {
    const raced = await prisma.orderSession.findUnique({
      where: { id: sessionRowId },
      include: { order: true },
    });
    if (raced?.orderId && raced.order) {
      console.info("[order.finalize] idempotent", {
        sessionId: sessionRowId,
        orderId: raced.orderId,
      });
      res.json({ orderId: raced.orderId, status: raced.order.status });
      return;
    }
    res.status(409).json({ error: "Checkout could not be started" });
    return;
  }

  try {
    const result = await runOrderCommitTransaction(
      prepared,
      toOrderCustomerInsertFromValidated(validated.data),
    );
    if (result.kind === "IDEMPOTENT") {
      console.info("[order.finalize] idempotent", {
        sessionId: prepared.session.id,
        orderId: result.orderId,
      });
    } else {
      console.info("[order.finalize]", {
        sessionId: prepared.session.id,
        orderId: result.orderId,
        status: result.status,
        imageCount: result.imageCount,
        storage: prepared.orderImageStorageKind,
      });
    }
    res.json({ orderId: result.orderId, status: result.status });
  } catch (e) {
    if (e instanceof Error && e.message === "SESSION_INCONSISTENT") {
      res.status(400).json({ error: "Order already submitted for this session" });
      return;
    }
    console.error("[order.finalize] failed", e);
    res.status(500).json({ error: "Could not create order" });
  }
});

/**
 * @deprecated Use POST /api/orders/finalize after customer + payment step. Session-only checks: POST /api/session/checkout/validate.
 */
ordersRouter.post("/", async (req: Request, res: Response) => {
  console.warn(
    "[deprecated] POST /api/orders — prefer POST /api/orders/finalize or session checkout validate",
  );

  const sessionId = req.cookies?.[sessionConfig.cookieName] as string | undefined;
  if (!sessionId) {
    res.status(400).json({ error: "Session required" });
    return;
  }

  const existing = await prisma.orderSession.findUnique({
    where: { id: String(sessionId) },
  });
  if (!existing) {
    clearSessionCookie(res);
    res.status(400).json({ error: "Session required" });
    return;
  }

  const now = new Date();
  const prep = await prepareOrderSessionCommit(sessionId, req.body, now, undefined);
  if (prep.ok === "idempotent") {
    console.info("[order.commit.legacy] idempotent", {
      sessionId: existing.id,
      orderId: prep.orderId,
      status: prep.status,
    });
    res.json({ orderId: prep.orderId, status: prep.status });
    return;
  }
  if (!prep.ok) {
    sendOrderPrepareError(res, prep.err);
    return;
  }

  const limitErr = await checkOrgOrderLimit(prep.prepared.organizationId);
  if (limitErr) {
    sendOrderPrepareError(res, limitErr);
    return;
  }

  try {
    const result = await runOrderCommitTransaction(prep.prepared, null);
    if (result.kind === "IDEMPOTENT") {
      console.info("[order.commit.legacy] idempotent", {
        sessionId: existing.id,
        orderId: result.orderId,
        status: result.status,
      });
    } else {
      console.info("[order.commit.legacy]", {
        sessionId: existing.id,
        orderId: result.orderId,
        imageCount: result.imageCount,
        status: result.status,
        storage: prep.prepared.orderImageStorageKind,
      });
    }
    res.json({ orderId: result.orderId, status: result.status });
  } catch (e) {
    if (e instanceof Error && e.message === "SESSION_INCONSISTENT") {
      res.status(400).json({ error: "Order already submitted for this session" });
      return;
    }
    console.error("[order.commit.legacy] failed", e);
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
