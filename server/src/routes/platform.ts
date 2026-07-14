/**
 * Platform owner routes — cross-tenant metrics (SaaS operator only).
 */
import type { Request, Response } from "express";
import { Router } from "express";
import {
  fetchPlatformOverview,
  fetchPlatformTenants,
} from "../lib/platformMetrics";
import {
  fetchPlatformEarlyAccess,
  setGrantLifetimeDiscount,
} from "../lib/platformEarlyAccess";

export const platformRouter = Router();

/** GET /api/platform/overview — cross-tenant KPIs. */
platformRouter.get("/overview", async (_req: Request, res: Response) => {
  const overview = await fetchPlatformOverview();
  res.json(overview);
});

/** GET /api/platform/tenants — paginated seller list. */
platformRouter.get("/tenants", async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(String(req.query.pageSize ?? "25"), 10) || 25),
  );
  const search =
    typeof req.query.search === "string" ? req.query.search : undefined;
  const sortRaw = String(req.query.sort ?? "createdAt");
  const sort =
    sortRaw === "ordersThisMonth" || sortRaw === "settledRevenue"
      ? sortRaw
      : "createdAt";
  const orderRaw = String(req.query.order ?? "desc");
  const order = orderRaw === "asc" ? "asc" : "desc";
  const usageFilterRaw =
    typeof req.query.usageFilter === "string" ? req.query.usageFilter : undefined;
  const usageFilters = [
    "nearOrderLimit",
    "nearEventLimit",
    "orderLimitReached",
    "eventLimitReached",
    "onboardingIncomplete",
    "erasurePending",
  ] as const;
  const usageFilter = usageFilters.includes(
    usageFilterRaw as (typeof usageFilters)[number],
  )
    ? (usageFilterRaw as (typeof usageFilters)[number])
    : undefined;

  const result = await fetchPlatformTenants({
    page,
    pageSize,
    search,
    sort,
    order,
    usageFilter,
  });
  res.json(result);
});

/** GET /api/platform/early-access — early-access subscribers. */
platformRouter.get("/early-access", async (_req: Request, res: Response) => {
  const result = await fetchPlatformEarlyAccess();
  res.json(result);
});

/** PATCH /api/platform/early-access/:orgId — toggle grantLifetimeDiscount. */
platformRouter.patch(
  "/early-access/:orgId",
  async (req: Request, res: Response) => {
    const orgId = String(req.params.orgId ?? "").trim();
    const body = req.body as { grantLifetimeDiscount?: unknown };
    if (typeof body.grantLifetimeDiscount !== "boolean") {
      res.status(400).json({ error: "grantLifetimeDiscount must be a boolean" });
      return;
    }
    const ok = await setGrantLifetimeDiscount(orgId, body.grantLifetimeDiscount);
    if (!ok) {
      res.status(404).json({ error: "Early-access organization not found" });
      return;
    }
    res.json({ ok: true, grantLifetimeDiscount: body.grantLifetimeDiscount });
  },
);

/** GET /api/platform/tenants/:orgId — seller detail for platform owner. */
platformRouter.get("/tenants/:orgId", async (req: Request, res: Response) => {
  const orgId = String(req.params.orgId ?? "").trim();
  const { prisma } = await import("../lib/prisma");
  const user = await prisma.user.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      deletedAt: true,
      erasureScheduledAt: true,
      organization: {
        select: {
          plan: true,
          name: true,
          currency: true,
          ordersThisMonth: true,
          orderLimit: true,
        },
      },
    },
  });
  if (!user) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    businessName: user.organization?.name,
    plan: user.organization?.plan,
    createdAt: user.createdAt.toISOString(),
    deletedAt: user.deletedAt?.toISOString() ?? null,
    erasureScheduledAt: user.erasureScheduledAt?.toISOString() ?? null,
    currency: user.organization?.currency,
    ordersThisMonth: user.organization?.ordersThisMonth,
    orderLimit: user.organization?.orderLimit,
  });
});

/** DELETE /api/platform/tenants/:orgId — schedule account erasure. */
platformRouter.delete("/tenants/:orgId", async (req: Request, res: Response) => {
  const orgId = String(req.params.orgId ?? "").trim();
  const { prisma } = await import("../lib/prisma");
  const { scheduleSellerAccountErasure } = await import("../lib/accountErasure");
  const ownerEmail = (req as Request & { platformOwnerEmail?: string }).platformOwnerEmail;

  const user = await prisma.user.findUnique({
    where: { id: orgId, deletedAt: null },
    select: { id: true },
  });
  if (!user) {
    res.status(404).json({ error: "Tenant not found or already deleted" });
    return;
  }

  const result = await scheduleSellerAccountErasure({
    userId: orgId,
    actorEmail: ownerEmail ?? undefined,
    reason: "platform_owner",
  });
  res.json({
    ok: true,
    erasureScheduledAt: result.erasureScheduledAt.toISOString(),
  });
});

/** POST /api/platform/tenants/:orgId/cancel-erasure */
platformRouter.post(
  "/tenants/:orgId/cancel-erasure",
  async (req: Request, res: Response) => {
    const orgId = String(req.params.orgId ?? "").trim();
    const { cancelScheduledAccountErasure } = await import("../lib/accountErasure");
    const ownerEmail = (req as Request & { platformOwnerEmail?: string }).platformOwnerEmail;

    await cancelScheduledAccountErasure({
      userId: orgId,
      actorEmail: ownerEmail ?? undefined,
    });
    res.json({ ok: true });
  },
);
