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
    const orgId = req.params.orgId;
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
