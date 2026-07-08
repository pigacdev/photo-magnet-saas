/**
 * Order routes: list/print, PATCH customer, Stripe helpers.
 * - POST /api/orders/finalize — create Order from session (preferred).
 * - POST /api/orders — deprecated; same as finalize without customer binding (legacy).
 */
import type { Request, Response } from "express";
import { Router } from "express";
import multer from "multer";
import { Prisma } from "../../../src/generated/prisma/client";
import { prisma } from "../lib/prisma";
import { sessionConfig } from "../config/session";
import { resolveAuthUser, type AuthUser } from "../lib/clerkSession";
import { authenticate, requireRole } from "../middleware/auth";
import { clearSessionCookie } from "../lib/orderSessionApi";
import { ORDER_IMAGE_LIST_ORDER_BY } from "../lib/magnetImageOrderBy";
import { validateOrderCustomerBody } from "../lib/orderCustomerValidation";
import {
  checkOrgOrderLimit,
  type PrepareCommitError,
  prepareOrderSessionCommit,
  runOrderCommitTransaction,
  toOrderCustomerInsertFromValidated,
} from "../lib/orderSessionCheckoutCommit";
import {
  canTransitionOrderStatus,
  isPrintEligibleStatus,
  isPrintPreviewEligibleStatus,
  isValidOrderStatus,
  parseCancellationNote,
  parseEventPaymentPreference,
} from "../lib/orderStatus";
import { validateOrderSessionContext } from "../lib/sessionContextValidation";
import {
  parseSellerOrderListQuery,
  paginateSellerOrders,
  querySellerOrders,
} from "../lib/sellerOrderListQuery";
import {
  buildOrdersExportCsv,
  ordersExportFilename,
} from "../lib/ordersCsvExport";
import {
  assertOrganizationFeature,
  FEATURE_REQUIRED,
  featureRequiredMessage,
} from "../lib/planFeatures";
import {
  expandOrderImagesForPrintSheet,
  generatePrintSheet,
} from "../lib/generatePrintSheet";
import { renderOrderImages, ensureOrderImagesRendered } from "../lib/renderOrderImages";
import {
  buildOrderEmailHtml,
  buildOrderEmailSubject,
  buildSellerToBuyerEmailHtml,
} from "../lib/email";
import { loadOrderEmailContext } from "../lib/orderEmailBranding";
import { sendOrderContextEmail, sendBuyerContextEmail } from "../lib/orderContextEmailSend";
import { isPlatformEmailSendReady } from "../lib/organizationEmailTransport";
import {
  getOrderContextNameFromMap,
  resolveOrderContextName,
  resolveOrderContextNames,
} from "../lib/orderContextDisplay";
import { loadStorefrontPickupAddress } from "../lib/storefront";
import {
  sendBuyerOrderConfirmationIfNeeded,
} from "../lib/orderBuyerConfirmationEmail";
import {
  allOrderImagesMediaRemoved,
  filterPrintableOrderImages,
} from "../lib/orderImageMediaAvailability";
import {
  ORDER_EMAIL_MAX_ATTACHMENTS,
  ORDER_EMAIL_MAX_FILE_BYTES,
  parseOrderEmailFormBody,
  validateOrderEmailAttachments,
} from "../lib/orderSendEmailValidation";

export const ordersRouter = Router();

const MEDIA_UNAVAILABLE_AFTER_RETENTION =
  "Media unavailable: files were removed after the retention period.";

const MARK_PRINTED_NO_PRINTABLE_MEDIA =
  "No printable images: media was removed after the retention period.";

const orderEmailUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: ORDER_EMAIL_MAX_FILE_BYTES,
    files: ORDER_EMAIL_MAX_ATTACHMENTS,
  },
});

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

/** Seller print fulfillment requires payment confirmed in workflow. */
function isReadyToPrintForSeller(order: { status: string }): boolean {
  return isPrintEligibleStatus(order.status as import("../../../src/generated/prisma/client").OrderStatus);
}

/** Seller print PDF preview: any active (non-cancelled) order. */
function isPrintPreviewEligibleForSeller(order: { status: string }): boolean {
  return isPrintPreviewEligibleStatus(order.status as import("../../../src/generated/prisma/client").OrderStatus);
}

/** GET /api/orders — seller list with search, filters, pagination (status filtered in memory). */
ordersRouter.get(
  "/",
  authenticate,
  requireRole("ADMIN", "STAFF"),
  async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    const parsed = parseSellerOrderListQuery(
      req.query as Record<string, unknown>,
    );
    if (!parsed.ok) {
      res.status(parsed.error.status).json({ error: parsed.error.error });
      return;
    }

    const { params } = parsed;
    const result = await querySellerOrders(userId, {
      search: params.search,
      expandedStatusFilter: params.expandedStatusFilter,
      createdAt: params.createdAt,
      contextType: params.contextType,
      contextId: params.contextId,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    });
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.error });
      return;
    }

    const { pageSlice, pagination } = paginateSellerOrders(
      result.rows,
      params.page,
      params.pageSize,
    );
    const contextNames = await resolveOrderContextNames(
      pageSlice.map((x) => ({
        contextType: x.row.contextType,
        contextId: x.row.contextId,
      })),
    );
    const pageItems = pageSlice.map((x) => ({
      ...x.payload,
      contextName: getOrderContextNameFromMap(
        contextNames,
        x.row.contextType,
        x.row.contextId,
      ),
    }));

    res.json({
      items: pageItems,
      pagination,
    });
  },
);

/** GET /api/orders/export.csv — CSV export of filtered/sorted orders (no pagination). */
ordersRouter.get(
  "/export.csv",
  authenticate,
  requireRole("ADMIN", "STAFF"),
  async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    try {
      await assertOrganizationFeature(userId, "orders_export_csv");
    } catch (err) {
      if (err instanceof Error && err.message === FEATURE_REQUIRED) {
        res
          .status(403)
          .json({ error: featureRequiredMessage("orders_export_csv") });
        return;
      }
      if (err instanceof Error && err.message === "Organization not found") {
        res.status(404).json({ error: "Organization not found" });
        return;
      }
      throw err;
    }

    const parsed = parseSellerOrderListQuery(
      req.query as Record<string, unknown>,
    );
    if (!parsed.ok) {
      res.status(parsed.error.status).json({ error: parsed.error.error });
      return;
    }

    const { params } = parsed;
    const result = await querySellerOrders(userId, {
      search: params.search,
      expandedStatusFilter: params.expandedStatusFilter,
      createdAt: params.createdAt,
      contextType: params.contextType,
      contextId: params.contextId,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    });
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.error });
      return;
    }

    const csv = buildOrdersExportCsv(result.rows);
    const filename = ordersExportFilename();

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    res.send(csv);
  },
);

/** GET /api/orders/contexts — seller's events and storefronts for order list filter dropdown. */
ordersRouter.get(
  "/contexts",
  authenticate,
  requireRole("ADMIN", "STAFF"),
  async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const [events, storefronts] = await Promise.all([
      prisma.event.findMany({
        where: { userId, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.storefront.findMany({
        where: { userId, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
    res.json({ events, storefronts });
  },
);

/** GET /api/orders/recent — lightweight poll for new orders since a timestamp. */
ordersRouter.get(
  "/recent",
  authenticate,
  requireRole("ADMIN", "STAFF"),
  async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const sinceRaw =
      typeof req.query.since === "string" ? req.query.since.trim() : "";
    if (!sinceRaw) {
      res.status(400).json({ error: "since query parameter is required" });
      return;
    }

    const sinceDate = new Date(sinceRaw);
    if (Number.isNaN(sinceDate.getTime())) {
      res.status(400).json({ error: "Invalid since timestamp" });
      return;
    }

    const orders = await prisma.order.findMany({
      where: {
        organizationId: userId,
        createdAt: { gt: sinceDate },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        customerName: true,
        createdAt: true,
        totalPrice: true,
        currency: true,
        orderImages: {
          select: { mediaDeletedAt: true, copies: true },
        },
      },
      take: 20,
    });

    res.json({
      items: orders.map((o) => {
        const printable = filterPrintableOrderImages(o.orderImages);
        return {
          id: o.id,
          customerName: o.customerName,
          createdAt: o.createdAt.toISOString(),
          totalPrice: o.totalPrice.toString(),
          currency: o.currency,
          magnetCount: printable.reduce(
            (sum, img) => sum + (img.copies ?? 1),
            0,
          ),
        };
      }),
    });
  },
);

/** GET /api/orders/new-count — count of orders awaiting first seller review (status NEW). */
ordersRouter.get(
  "/new-count",
  authenticate,
  requireRole("ADMIN", "STAFF"),
  async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const count = await prisma.order.count({
      where: { organizationId: userId, status: "NEW" },
    });
    res.json({ count });
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
    if (!isPrintPreviewEligibleForSeller(order)) {
      res.status(400).json({
        error: "Cancelled orders cannot be printed",
      });
      return;
    }
    if (order.orderImages.length === 0) {
      res.status(400).json({ error: "No images to print" });
      return;
    }
    if (allOrderImagesMediaRemoved(order.orderImages)) {
      res.status(400).json({ error: MEDIA_UNAVAILABLE_AFTER_RETENTION });
      return;
    }

    const printable = filterPrintableOrderImages(order.orderImages);
    if (printable.length === 0) {
      res.status(400).json({ error: MEDIA_UNAVAILABLE_AFTER_RETENTION });
      return;
    }

    try {
      await renderOrderImages(
        orderId,
        printable.map((img) => ({
          id: img.id,
          originalUrl: img.originalUrl,
          cropX: img.cropX,
          cropY: img.cropY,
          cropWidth: img.cropWidth,
          cropHeight: img.cropHeight,
          rotation: img.rotation,
        })),
      );
    } catch (renderErr) {
      console.warn("[print-preview] renderOrderImages", renderErr);
    }

    const refreshed = await prisma.orderImage.findMany({
      where: { orderId, mediaDeletedAt: null },
      orderBy: ORDER_IMAGE_LIST_ORDER_BY,
    });
    const grouped: Record<string, typeof refreshed> = {};
    for (const img of refreshed) {
      if (!grouped[img.shapeId]) grouped[img.shapeId] = [];
      grouped[img.shapeId]!.push(img);
    }

    const shapeIds = Object.keys(grouped);
    const allowedShapes = await prisma.allowedShape.findMany({
      where: { id: { in: shapeIds } },
      select: { id: true, shapeType: true, widthMm: true, heightMm: true },
    });
    const shapeById = new Map(allowedShapes.map((s) => [s.id, s]));

    const urls: string[] = [];
    for (const shapeId of shapeIds) {
      const imgs = grouped[shapeId];
      if (!imgs?.length) continue;
      const shapeRow = shapeById.get(shapeId);
      if (!shapeRow) continue;
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
        {
          shapeType: shapeRow.shapeType,
          widthMm: shapeRow.widthMm,
          heightMm: shapeRow.heightMm,
        },
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
      include: {
        orderImages: { orderBy: ORDER_IMAGE_LIST_ORDER_BY },
      },
    });
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (!isReadyToPrintForSeller(order)) {
      res.status(400).json({
        error: "Order must be marked as paid before printing",
      });
      return;
    }
    if (allOrderImagesMediaRemoved(order.orderImages)) {
      res.status(400).json({ error: MEDIA_UNAVAILABLE_AFTER_RETENTION });
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

    if (images.some((img) => img.mediaDeletedAt != null)) {
      res.status(400).json({ error: MEDIA_UNAVAILABLE_AFTER_RETENTION });
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
          rotation: img.rotation,
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

    const shapeIds = Object.keys(grouped);
    const allowedShapes = await prisma.allowedShape.findMany({
      where: { id: { in: shapeIds } },
      select: { id: true, shapeType: true, widthMm: true, heightMm: true },
    });
    const shapeById = new Map(allowedShapes.map((s) => [s.id, s]));

    const urls: string[] = [];
    for (const shapeId of shapeIds) {
      const groupImages = grouped[shapeId];
      if (!groupImages?.length) continue;
      const shapeRow = shapeById.get(shapeId);
      if (!shapeRow) continue;
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
        {
          shapeType: shapeRow.shapeType,
          widthMm: shapeRow.widthMm,
          heightMm: shapeRow.heightMm,
        },
      );
      urls.push(pdfUrl);
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.orderImage.updateMany({
        where: {
          orderId,
          id: { in: imageIds },
          printed: false,
          mediaDeletedAt: null,
        },
        data: { printed: true, printedAt: now },
      });
      const unprinted = await tx.orderImage.count({
        where: { orderId, printed: false, mediaDeletedAt: null },
      });
      if (unprinted === 0) {
        const orderBefore = await tx.order.findUnique({
          where: { id: orderId },
          select: { status: true },
        });
        await tx.order.update({
          where: { id: orderId },
          data: {
            printedAt: now,
            ...(orderBefore?.status === "PAID" ? { status: "IN_PRODUCTION" } : {}),
          },
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
      select: {
        id: true,
        status: true,
        orderImages: {
          select: { id: true, printed: true, mediaDeletedAt: true },
        },
      },
    });
    if (!existing) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (!isReadyToPrintForSeller(existing)) {
      res.status(400).json({
        error: "Order must be marked as paid before marking as printed",
      });
      return;
    }
    if (existing.orderImages.length === 0) {
      res.status(400).json({ error: "No images to mark as printed" });
      return;
    }
    if (allOrderImagesMediaRemoved(existing.orderImages)) {
      res.status(400).json({ error: MARK_PRINTED_NO_PRINTABLE_MEDIA });
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
        select: { id: true, mediaDeletedAt: true },
      });
      if (found.length !== imageIdList.length) {
        res.status(400).json({
          error: "One or more images not found on this order",
        });
        return;
      }
      if (found.some((r) => r.mediaDeletedAt != null)) {
        res.status(400).json({ error: MEDIA_UNAVAILABLE_AFTER_RETENTION });
        return;
      }
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      if (imageIdList && imageIdList.length > 0) {
        await tx.orderImage.updateMany({
          where: {
            orderId,
            id: { in: imageIdList },
            printed: false,
            mediaDeletedAt: null,
          },
          data: { printed: true, printedAt: now },
        });
      } else {
        await tx.orderImage.updateMany({
          where: { orderId, printed: false, mediaDeletedAt: null },
          data: { printed: true, printedAt: now },
        });
      }

      const unprinted = await tx.orderImage.count({
        where: { orderId, printed: false, mediaDeletedAt: null },
      });
      if (unprinted === 0) {
        await tx.order.update({
          where: { id: orderId },
          data: {
            printedAt: now,
            ...(existing.status === "PAID" ? { status: "IN_PRODUCTION" } : {}),
          },
        });
      }
    });

    const orderRow = await prisma.order.findUnique({
      where: { id: orderId },
      select: { printedAt: true },
    });
    const allImagesPrinted =
      (await prisma.orderImage.count({
        where: { orderId, printed: false, mediaDeletedAt: null },
      })) === 0;

    res.json({
      ok: true,
      printedAt: orderRow?.printedAt?.toISOString() ?? null,
      allImagesPrinted,
    });
  },
);

/**
 * PATCH /api/orders/:id/status — seller advances order workflow.
 */
ordersRouter.patch(
  "/:id/status",
  authenticate,
  requireRole("ADMIN", "STAFF"),
  async (req: Request, res: Response) => {
    const orderId = String(req.params.id ?? "").trim();
    if (!orderId) {
      res.status(400).json({ error: "Order id required" });
      return;
    }
    const owner = req.user!.userId;

    const body = req.body as { status?: unknown; cancellationNote?: unknown };
    const nextStatusRaw =
      typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
    if (!isValidOrderStatus(nextStatusRaw)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    let cancellationNote: string | null = null;
    if (nextStatusRaw === "CANCELLED") {
      try {
        cancellationNote = parseCancellationNote(body.cancellationNote);
      } catch (e) {
        res.status(400).json({
          error: e instanceof Error ? e.message : "Invalid cancellation note",
        });
        return;
      }
    } else if (body.cancellationNote !== undefined && body.cancellationNote !== null) {
      res.status(400).json({
        error: "cancellationNote is only allowed when cancelling an order",
      });
      return;
    }

    const existing = await prisma.order.findFirst({
      where: { id: orderId, organizationId: owner },
      select: { id: true, status: true, printedAt: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (existing.status === nextStatusRaw) {
      res.json({ ok: true, status: existing.status });
      return;
    }

    if (!canTransitionOrderStatus(existing.status, nextStatusRaw)) {
      res.status(400).json({
        error: `Cannot change status from ${existing.status} to ${nextStatusRaw}`,
      });
      return;
    }

    if (nextStatusRaw === "SHIPPED" && !existing.printedAt) {
      res.status(400).json({ error: "Mark as printed before shipping" });
      return;
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: nextStatusRaw,
        ...(nextStatusRaw === "SHIPPED" ? { shippedAt: new Date() } : {}),
        ...(nextStatusRaw === "CANCELLED" ? { cancellationNote } : {}),
      },
      select: { status: true, shippedAt: true, cancellationNote: true },
    });

    res.json({
      ok: true,
      status: updated.status,
      shippedAt: updated.shippedAt?.toISOString() ?? null,
      cancellationNote: updated.cancellationNote,
    });
  },
);

/**
 * @deprecated Use PATCH /api/orders/:id/status with { status: "SHIPPED" }.
 */
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
      select: { id: true, printedAt: true, status: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (!existing.printedAt) {
      res.status(400).json({ error: "Mark as printed before shipping" });
      return;
    }
    if (
      existing.status !== "IN_PRODUCTION" &&
      existing.status !== "SHIPPED" &&
      existing.status !== "COMPLETED"
    ) {
      res.status(400).json({ error: "Order must be in production before shipping" });
      return;
    }
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { shippedAt: new Date(), status: "SHIPPED" },
      select: { shippedAt: true, status: true },
    });
    res.json({
      shippedAt: updated.shippedAt!.toISOString(),
      status: updated.status,
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
    const sellerUser = await resolveAuthUser(req);
    if (
      sellerUser &&
      (sellerUser.role === "ADMIN" || sellerUser.role === "STAFF") &&
      sellerUser.userId === order.organizationId
    ) {
      authorized = true;
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
      customerEmail: data.customerEmail,
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
      const org = await prisma.organization.findUnique({
        where: { id: orderFull.organizationId },
        select: { plan: true },
      });
      const plan = org?.plan ?? "FREE";
      const { contextName, sendOrderEmails, notificationEmail, storefrontPickupAddress, branding } =
        await loadOrderEmailContext(
          { contextType: orderFull.contextType, contextId: orderFull.contextId },
          plan,
        );

      if (sendOrderEmails && notificationEmail) {
        await sendOrderContextEmail({
          to: notificationEmail,
          subject: buildOrderEmailSubject(orderFull, contextName),
          html: buildOrderEmailHtml(orderFull, contextName, {
            storefrontPickupAddress,
            branding,
          }),
          notificationEmail,
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
  const eventPaymentPreference =
    sessionRow.contextType === "EVENT"
      ? parseEventPaymentPreference(body.paymentMethod ?? body.eventPaymentPreference)
      : null;

  const customerBody = {
    customerName: body.customerName,
    customerEmail: body.customerEmail,
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

  if (
    sessionRow.contextType === "STOREFRONT" &&
    validated.data.shippingType === "pickup"
  ) {
    const pickupAddress = await loadStorefrontPickupAddress(
      String(sessionRow.contextId),
    );
    if (!pickupAddress) {
      res.status(400).json({ error: "Pickup is not available for this storefront" });
      return;
    }
  }

  const now = new Date();
  const prep = await prepareOrderSessionCommit(sessionId, req.body, now, "NEW");
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
    data: { checkoutStage: "COMPLETED", lastActiveAt: now },
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
      toOrderCustomerInsertFromValidated(validated.data, eventPaymentPreference),
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
      try {
        await ensureOrderImagesRendered(result.orderId);
      } catch (renderErr) {
        console.error("[order.finalize] ensureOrderImagesRendered failed", renderErr);
      }
      try {
        await sendBuyerOrderConfirmationIfNeeded(result.orderId);
      } catch (err) {
        console.error("[email] buyer confirmation failed after finalize", err);
      }
      try {
        const orderFull = await prisma.order.findUnique({
          where: { id: result.orderId },
          include: { orderImages: true },
        });
        if (orderFull) {
          const org = await prisma.organization.findUnique({
            where: { id: orderFull.organizationId },
            select: { plan: true },
          });
          const plan = org?.plan ?? "FREE";
          const { contextName, sendOrderEmails, notificationEmail, storefrontPickupAddress, branding } =
            await loadOrderEmailContext(
              { contextType: orderFull.contextType, contextId: orderFull.contextId },
              plan,
            );
          if (sendOrderEmails && notificationEmail) {
            await sendOrderContextEmail({
              to: notificationEmail,
              subject: buildOrderEmailSubject(orderFull, contextName),
              html: buildOrderEmailHtml(orderFull, contextName, {
                storefrontPickupAddress,
                branding,
              }),
              notificationEmail,
            });
          }
        }
      } catch (err) {
        console.error("[email] seller notification failed after finalize", err);
      }
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
 * POST /api/orders/:id/send-email — seller sends a custom email to the buyer.
 */
ordersRouter.post(
  "/:id/send-email",
  authenticate,
  requireRole("ADMIN", "STAFF"),
  (req, res, next) => {
    orderEmailUpload.array("attachments", ORDER_EMAIL_MAX_ATTACHMENTS)(
      req,
      res,
      (err) => {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            res.status(400).json({ error: "Each attachment must be 10 MB or smaller" });
            return;
          }
          if (err.code === "LIMIT_FILE_COUNT") {
            res.status(400).json({
              error: `At most ${ORDER_EMAIL_MAX_ATTACHMENTS} attachments allowed`,
            });
            return;
          }
          res.status(400).json({ error: err.message });
          return;
        }
        if (err) {
          next(err);
          return;
        }
        void (async () => {
          const orderId = String(req.params.id ?? "").trim();
          if (!orderId) {
            res.status(400).json({ error: "Order id required" });
            return;
          }

          const owner = req.user!.userId;
          const order = await prisma.order.findFirst({
            where: { id: orderId, organizationId: owner },
            select: {
              id: true,
              shortCode: true,
              contextType: true,
              contextId: true,
            },
          });
          if (!order) {
            res.status(404).json({ error: "Order not found" });
            return;
          }

          try {
            await assertOrganizationFeature(owner, "manual_send_email");
          } catch (err) {
            if (err instanceof Error && err.message === FEATURE_REQUIRED) {
              res
                .status(403)
                .json({ error: featureRequiredMessage("manual_send_email") });
              return;
            }
            if (err instanceof Error && err.message === "Organization not found") {
              res.status(404).json({ error: "Organization not found" });
              return;
            }
            throw err;
          }

          const parsed = parseOrderEmailFormBody(
            req.body as Record<string, unknown>,
          );
          if (!parsed.ok) {
            res.status(400).json({ error: parsed.error });
            return;
          }

          const attachmentResult = validateOrderEmailAttachments(
            req.files as Express.Multer.File[] | undefined,
          );
          if (!attachmentResult.ok) {
            res.status(400).json({ error: attachmentResult.error });
            return;
          }

          const org = await prisma.organization.findUnique({
            where: { id: owner },
            select: { plan: true },
          });
          const plan = org?.plan ?? "FREE";

          if (!isPlatformEmailSendReady()) {
            res.status(503).json({ error: "Email service is not configured" });
            return;
          }

          const { contextName, notificationEmail, branding } =
            await loadOrderEmailContext(
              { contextType: order.contextType, contextId: order.contextId },
              plan,
            );

          const orderReference =
            order.shortCode?.trim() || order.id.slice(0, 8).toUpperCase();

          const html = buildSellerToBuyerEmailHtml({
            contextName,
            orderReference,
            messageHtml: parsed.messageHtml,
            branding,
          });

          try {
            const sent = await sendBuyerContextEmail({
              to: parsed.to,
              subject: parsed.subject,
              html,
              notificationEmail,
              attachments: attachmentResult.attachments,
            });
            if (!sent) {
              res.status(503).json({ error: "Email service is not configured" });
              return;
            }
          } catch (err) {
            console.error("[orders.send-email] failed", err);
            res.status(500).json({ error: "Could not send email" });
            return;
          }

          res.json({ ok: true });
        })().catch(next);
      },
    );
  },
);

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

  let sellerUser: AuthUser | null = await resolveAuthUser(req);

  if (sellerUser) {
    let order = await prisma.order.findFirst({
      where: { id: orderId, organizationId: sellerUser.userId },
      include: {
        orderImages: { orderBy: ORDER_IMAGE_LIST_ORDER_BY },
      },
    });
    if (order) {
      try {
        await ensureOrderImagesRendered(orderId);
        order = await prisma.order.findFirst({
          where: { id: orderId, organizationId: sellerUser.userId },
          include: {
            orderImages: { orderBy: ORDER_IMAGE_LIST_ORDER_BY },
          },
        });
      } catch (renderErr) {
        console.warn("[orders.get] ensureOrderImagesRendered", renderErr);
      }
      if (!order) {
        res.status(404).json({ error: "Order not found" });
        return;
      }
      const orderRow = order;
      const shapeIds = [...new Set(orderRow.orderImages.map((i) => i.shapeId))];
      const shapes = await prisma.allowedShape.findMany({
        where: { id: { in: shapeIds } },
        select: { id: true, shapeType: true, widthMm: true, heightMm: true },
      });
      const shapeById = new Map(shapes.map((s) => [s.id, s]));
      const printSheets = shapeIds.map((sid) => {
        const sh = shapeById.get(sid);
        return {
          url: `/uploads/print-sheets/${orderRow.id}-${sid}.pdf`,
          widthMm: sh?.widthMm ?? 0,
          heightMm: sh?.heightMm ?? 0,
        };
      });
      const contextName = await resolveOrderContextName(
        orderRow.contextType,
        orderRow.contextId,
      );
      const storefrontPickupAddress =
        orderRow.contextType === "STOREFRONT"
          ? await loadStorefrontPickupAddress(orderRow.contextId)
          : null;
      res.json({
        orderId: orderRow.id,
        shortCode: orderRow.shortCode,
        status: orderRow.status,
        cancellationNote: orderRow.cancellationNote,
        eventPaymentPreference: orderRow.eventPaymentPreference,
        contextType: orderRow.contextType,
        contextId: orderRow.contextId,
        contextName,
        totalPrice: orderRow.totalPrice.toString(),
        currency: orderRow.currency,
        imageCount: orderRow.orderImages.length,
        createdAt: orderRow.createdAt.toISOString(),
        customerName: orderRow.customerName,
        customerEmail: orderRow.customerEmail,
        customerPhone: orderRow.customerPhone,
        shippingType: orderRow.shippingType,
        shippingAddress: orderRow.shippingAddress,
        storefrontPickupAddress,
        printedAt: orderRow.printedAt?.toISOString() ?? null,
        shippedAt: orderRow.shippedAt?.toISOString() ?? null,
        images: orderRow.orderImages.map((img) => {
          const sh = shapeById.get(img.shapeId);
          return {
            id: img.id,
            renderedUrl:
              img.mediaDeletedAt != null ? null : img.renderedUrl,
            mediaDeletedAt: img.mediaDeletedAt?.toISOString() ?? null,
            position: img.position,
            shapeId: img.shapeId,
            shapeType: sh?.shapeType ?? "SQUARE",
            widthMm: sh?.widthMm ?? 50,
            heightMm: sh?.heightMm ?? 50,
            copies: img.copies,
            printed: img.printed,
            printedAt: img.printedAt?.toISOString() ?? null,
          };
        }),
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
      customerEmail: true,
      customerPhone: true,
      shippingType: true,
      shippingAddress: true,
      totalPrice: true,
      currency: true,
      orderImages: {
        select: { shapeId: true, copies: true },
      },
    },
  });

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  let orderSummary: {
    shapeType: string;
    widthMm: number;
    heightMm: number;
    quantity: number;
  } | null = null;

  if (order.orderImages.length > 0) {
    const shapeId = order.orderImages[0]!.shapeId;
    const quantity = order.orderImages.reduce(
      (sum, img) => sum + (img.copies ?? 1),
      0,
    );
    const shape = await prisma.allowedShape.findUnique({
      where: { id: shapeId },
      select: { shapeType: true, widthMm: true, heightMm: true },
    });
    if (shape) {
      orderSummary = {
        shapeType: shape.shapeType,
        widthMm: shape.widthMm,
        heightMm: shape.heightMm,
        quantity,
      };
    }
  }

  const storefrontPickupAddress =
    order.contextType === "STOREFRONT"
      ? await loadStorefrontPickupAddress(order.contextId)
      : null;

  res.json({
    orderId: order.id,
    status: order.status,
    contextType: order.contextType,
    contextId: order.contextId,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    shippingType: order.shippingType,
    shippingAddress: order.shippingAddress,
    storefrontPickupAddress,
    totalPrice: order.totalPrice.toString(),
    currency: order.currency,
    imageCount: order.orderImages.length,
    orderSummary,
  });
});
