/**
 * Admin-only routes (mounted at /api/admin with authenticate + role).
 * Read-only reconciliation; no Stripe calls, no mutations.
 */
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { Prisma } from "../../../src/generated/prisma/client";
import {
  cleanupAbandonedSessionMedia,
  cleanupPrintSheets,
} from "../lib/mediaCleanup";
import { requireRole } from "../middleware/auth";
import { prisma } from "../lib/prisma";

export const adminRouter = Router();

/**
 * When `MEDIA_CLEANUP_SECRET` is set, `POST` media cleanup also requires
 * `X-Media-Cleanup-Secret: <same value>`. Omitted or empty env = no extra header.
 */
function requireMediaCleanupSecret(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.MEDIA_CLEANUP_SECRET;
  if (secret == null || String(secret).trim() === "") {
    next();
    return;
  }
  if (req.get("X-Media-Cleanup-Secret") !== secret) {
    res.status(403).json({ error: "Invalid or missing media cleanup secret" });
    return;
  }
  next();
}
const ORDER_SESSION_STATUSES = ["ACTIVE", "ABANDONED", "CONVERTED", "EXPIRED"] as const;
type OrderSessionStatusFilter = (typeof ORDER_SESSION_STATUSES)[number];

function parseIsoDateOnly(s: string, endOfDay: boolean): Date | null {
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return null;
  }
  const d = new Date(`${t}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseOptionalDayQuery(
  raw: unknown,
  mode: "from" | "to",
): { ok: true; value: Date | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: `Invalid ${mode} (use YYYY-MM-DD)` };
  }
  const d = parseIsoDateOnly(raw, mode === "to");
  if (!d) {
    return { ok: false, error: `Invalid ${mode} (use YYYY-MM-DD)` };
  }
  return { ok: true, value: d };
}

/**
 * GET /api/admin/reconciliation/stripe-orphans
 *
 * Order sessions where Stripe reports paid on the Checkout Session but no Order row was linked.
 * Scoped to events/storefronts owned by the authenticated seller (userId = organization).
 */
adminRouter.get("/reconciliation/stripe-orphans", async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const statusRaw = req.query.status;
  let statusFilter: OrderSessionStatusFilter | undefined;
  if (statusRaw !== undefined && statusRaw !== null && String(statusRaw) !== "") {
    const s = String(statusRaw).trim();
    if (!(ORDER_SESSION_STATUSES as readonly string[]).includes(s)) {
      res.status(400).json({ error: "Invalid status filter" });
      return;
    }
    statusFilter = s as OrderSessionStatusFilter;
  }

  const ctRaw = req.query.contextType;
  let contextTypeFilter: "EVENT" | "STOREFRONT" | undefined;
  if (ctRaw !== undefined && ctRaw !== null && String(ctRaw) !== "") {
    const c = String(ctRaw).trim();
    if (c !== "EVENT" && c !== "STOREFRONT") {
      res.status(400).json({ error: "contextType must be EVENT or STOREFRONT" });
      return;
    }
    contextTypeFilter = c;
  }

  const fromParsed = parseOptionalDayQuery(req.query.from, "from");
  if (!fromParsed.ok) {
    res.status(400).json({ error: fromParsed.error });
    return;
  }
  const toParsed = parseOptionalDayQuery(req.query.to, "to");
  if (!toParsed.ok) {
    res.status(400).json({ error: toParsed.error });
    return;
  }

  const [events, storefronts] = await Promise.all([
    prisma.event.findMany({
      where: { userId, deletedAt: null },
      select: { id: true },
    }),
    prisma.storefront.findMany({
      where: { userId, deletedAt: null },
      select: { id: true },
    }),
  ]);

  const eventIds = events.map((e) => e.id);
  const storefrontIds = storefronts.map((s) => s.id);

  if (eventIds.length === 0 && storefrontIds.length === 0) {
    res.json({ items: [], total: 0 });
    return;
  }

  const orgScope: Prisma.OrderSessionWhereInput[] = [];
  if (eventIds.length > 0) {
    orgScope.push({ contextType: "EVENT", contextId: { in: eventIds } });
  }
  if (storefrontIds.length > 0) {
    orgScope.push({ contextType: "STOREFRONT", contextId: { in: storefrontIds } });
  }

  const where: Prisma.OrderSessionWhereInput = {
    orderId: null,
    stripePaymentStatus: { equals: "paid", mode: "insensitive" },
    OR: orgScope,
  };

  if (statusFilter) {
    where.status = statusFilter;
  }
  if (contextTypeFilter) {
    where.contextType = contextTypeFilter;
  }

  if (fromParsed.value || toParsed.value) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (fromParsed.value) {
      createdAt.gte = fromParsed.value;
    }
    if (toParsed.value) {
      createdAt.lte = toParsed.value;
    }
    where.createdAt = createdAt;
  }

  const rows = await prisma.orderSession.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      contextType: true,
      contextId: true,
      checkoutStage: true,
      status: true,
      expiresAt: true,
      totalPrice: true,
      quantity: true,
      checkoutCustomerName: true,
      checkoutCustomerPhone: true,
      checkoutShippingType: true,
      checkoutShippingAddress: true,
      checkoutImageCopies: true,
      stripePaymentIntentId: true,
      stripeCheckoutSessionId: true,
      createdAt: true,
      lastActiveAt: true,
    },
  });

  const items = rows.map((r) => ({
    orderSessionId: r.id,
    contextType: r.contextType,
    contextId: r.contextId,
    checkoutStage: r.checkoutStage,
    status: r.status,
    totalPrice: r.totalPrice != null ? String(r.totalPrice) : null,
    quantity: r.quantity,
    checkoutCustomerName: r.checkoutCustomerName,
    checkoutCustomerPhone: r.checkoutCustomerPhone,
    checkoutShippingType: r.checkoutShippingType,
    checkoutShippingAddress: r.checkoutShippingAddress,
    checkoutImageCopies: r.checkoutImageCopies,
    stripePaymentIntentId: r.stripePaymentIntentId,
    stripeCheckoutSessionId: r.stripeCheckoutSessionId,
    createdAt: r.createdAt.toISOString(),
    lastActiveAt: r.lastActiveAt.toISOString(),
  }));

  res.json({ items, total: items.length });
});

/**
 * POST /api/admin/media-cleanup/abandoned-sessions/global
 *
 * System-wide session upload file cleanup. **ADMIN only** (not STAFF).
 * Optional second factor: if `MEDIA_CLEANUP_SECRET` is set, client must send
 * `X-Media-Cleanup-Secret` with the same value.
 *
 * Body: `{ "dryRun"?: boolean }` — defaults to `true` (no file deletes; dry run still lists issues).
 * Scans all organizations; does not delete DB rows. Same eligibility rules as `cleanupAbandonedSessionMedia`.
 */
adminRouter.post(
  "/media-cleanup/abandoned-sessions/global",
  requireRole("ADMIN"),
  requireMediaCleanupSecret,
  async (req: Request, res: Response) => {
    const rawDry = req.body?.dryRun;
    const dryRun = typeof rawDry === "boolean" ? rawDry : true;

    try {
      const result = await cleanupAbandonedSessionMedia({ dryRun });
      res.json({ ...result, scope: "global" as const });
    } catch (err) {
      console.error("[media-cleanup] abandoned-sessions/global", err);
      res.status(500).json({
        error: "Media cleanup failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  },
);

/**
 * POST /api/admin/media-cleanup/print-sheets/global
 *
 * Deletes generated print-sheet PDFs older than PRINT_SHEET_RETENTION_HOURS (see mediaRetention config).
 * **ADMIN only.** Same optional `X-Media-Cleanup-Secret` as other media cleanup routes.
 *
 * Body: `{ "dryRun"?: boolean }` — defaults to `true`.
 * Does not modify database rows.
 */
adminRouter.post(
  "/media-cleanup/print-sheets/global",
  requireRole("ADMIN"),
  requireMediaCleanupSecret,
  async (req: Request, res: Response) => {
    const rawDry = req.body?.dryRun;
    const dryRun = typeof rawDry === "boolean" ? rawDry : true;

    try {
      const result = await cleanupPrintSheets({ dryRun });
      res.json({ ...result, scope: "global" as const });
    } catch (err) {
      console.error("[media-cleanup] print-sheets/global", err);
      res.status(500).json({
        error: "Media cleanup failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  },
);
