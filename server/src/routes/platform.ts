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
import {
  PlatformNotificationError,
  sendPlatformNotifications,
  type PlatformNotificationSelection,
} from "../lib/platformNotifications";

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

function parseNotificationSelection(
  raw: unknown,
): PlatformNotificationSelection | null {
  if (!raw || typeof raw !== "object") return null;
  const sel = raw as Record<string, unknown>;
  const mode = sel.mode;
  if (mode === "explicit") {
    if (!Array.isArray(sel.userIds)) return null;
    const userIds = sel.userIds.filter((id) => typeof id === "string") as string[];
    return { mode: "explicit", userIds };
  }
  if (mode === "all_matching") {
    const filters =
      sel.filters && typeof sel.filters === "object"
        ? (sel.filters as Record<string, unknown>)
        : {};
    const excludeUserIds = Array.isArray(sel.excludeUserIds)
      ? (sel.excludeUserIds.filter((id) => typeof id === "string") as string[])
      : undefined;
    return {
      mode: "all_matching",
      filters: {
        search: typeof filters.search === "string" ? filters.search : undefined,
        usageFilter:
          typeof filters.usageFilter === "string"
            ? filters.usageFilter
            : undefined,
        sort: typeof filters.sort === "string" ? filters.sort : undefined,
        order: typeof filters.order === "string" ? filters.order : undefined,
      },
      excludeUserIds,
    };
  }
  return null;
}

/** POST /api/platform/notifications/send — bulk email to selected sellers. */
platformRouter.post("/notifications/send", async (req: Request, res: Response) => {
  const ownerEmail = (req as Request & { platformOwnerEmail?: string })
    .platformOwnerEmail;
  if (!ownerEmail) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const body = req.body as {
    subject?: unknown;
    html?: unknown;
    includeOptedOut?: unknown;
    selection?: unknown;
  };

  if (typeof body.subject !== "string" || typeof body.html !== "string") {
    res.status(400).json({ error: "subject and html are required" });
    return;
  }
  if (typeof body.includeOptedOut !== "boolean") {
    res.status(400).json({ error: "includeOptedOut must be a boolean" });
    return;
  }

  const selection = parseNotificationSelection(body.selection);
  if (!selection) {
    res.status(400).json({ error: "Invalid selection" });
    return;
  }

  try {
    const result = await sendPlatformNotifications({
      subject: body.subject,
      html: body.html,
      includeOptedOut: body.includeOptedOut,
      selection,
      sentByEmail: ownerEmail,
    });
    res.json(result);
  } catch (err) {
    if (err instanceof PlatformNotificationError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error("[POST /api/platform/notifications/send]", err);
    res.status(500).json({ error: "Failed to send notifications" });
  }
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
