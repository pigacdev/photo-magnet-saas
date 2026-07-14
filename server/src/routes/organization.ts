import { Router } from "express";
import { CURRENT_POLICY_VERSION } from "../lib/legalConstants";
import { logAuditEvent } from "../lib/privacyAuditLog";
import { CURRENCY_OPTIONS } from "../lib/currency";
import {
  DATE_FORMAT_OPTIONS,
  getOrganizationDisplayPreferences,
  patchOrganizationDisplayPreferences,
  SIZE_UNIT_OPTIONS,
} from "../lib/organizationDisplayPreferences";
import {
  organizationHasCommittedOrders,
  patchOrganizationCurrency,
} from "../lib/organizationCurrency";
import { patchOrganizationName } from "../lib/organizationName";
import { prisma } from "../lib/prisma";

export const organizationRouter = Router();

organizationRouter.get("/settings", async (req, res) => {
  const userId = req.user!.userId;

  const org = await prisma.organization.findUnique({
    where: { id: userId },
    select: { currency: true, initialSetupAt: true, dateFormat: true, sizeUnit: true, name: true },
  });

  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  const hasOrders = await organizationHasCommittedOrders(userId);
  const currencyLocked = org.currency != null;
  const displayPreferences = await getOrganizationDisplayPreferences(userId);

  res.json({
    currency: org.currency,
    initialSetupAt: org.initialSetupAt?.toISOString() ?? null,
    currencyLocked,
    hasOrders,
    supportedCurrencies: CURRENCY_OPTIONS,
    dateFormat: displayPreferences.dateFormat,
    sizeUnit: displayPreferences.sizeUnit,
    supportedDateFormats: DATE_FORMAT_OPTIONS,
    supportedSizeUnits: SIZE_UNIT_OPTIONS,
    name: org.name?.trim() || null,
  });
});

organizationRouter.patch("/settings", async (req, res) => {
  const userId = req.user!.userId;
  const body = req.body as {
    currency?: unknown;
    dateFormat?: unknown;
    sizeUnit?: unknown;
    name?: unknown;
  };

  const hasCurrency = body.currency !== undefined;
  const hasDisplayPrefs =
    body.dateFormat !== undefined || body.sizeUnit !== undefined;
  const hasName = body.name !== undefined;

  if (!hasCurrency && !hasDisplayPrefs && !hasName) {
    res.status(400).json({
      error: "At least one of currency, dateFormat, sizeUnit, or name is required",
    });
    return;
  }

  if (hasCurrency) {
    if (typeof body.currency !== "string" || !body.currency.trim()) {
      res.status(400).json({ error: "currency is required" });
      return;
    }

    const currencyResult = await patchOrganizationCurrency(userId, body.currency);
    if (!currencyResult.ok) {
      res.status(currencyResult.status).json({ error: currencyResult.error });
      return;
    }
  }

  if (hasDisplayPrefs) {
    const displayResult = await patchOrganizationDisplayPreferences(userId, {
      dateFormat: body.dateFormat,
      sizeUnit: body.sizeUnit,
    });
    if (!displayResult.ok) {
      res.status(displayResult.status).json({ error: displayResult.error });
      return;
    }
  }

  if (hasName) {
    const nameResult = await patchOrganizationName(userId, body.name);
    if (!nameResult.ok) {
      res.status(nameResult.status).json({ error: nameResult.error });
      return;
    }
  }

  const org = await prisma.organization.findUnique({
    where: { id: userId },
    select: {
      currency: true,
      initialSetupAt: true,
      dateFormat: true,
      sizeUnit: true,
      name: true,
    },
  });

  const hasOrders = await organizationHasCommittedOrders(userId);
  const displayPreferences = await getOrganizationDisplayPreferences(userId);

  res.json({
    currency: org?.currency ?? null,
    initialSetupAt: org?.initialSetupAt?.toISOString() ?? null,
    currencyLocked: org?.currency != null,
    hasOrders,
    dateFormat: displayPreferences.dateFormat,
    sizeUnit: displayPreferences.sizeUnit,
    name: org?.name?.trim() || null,
  });
});

/** PATCH /api/organization/legal-acceptance — record Terms/Privacy acceptance. */
organizationRouter.patch("/legal-acceptance", async (req, res) => {
  const userId = req.user!.userId;
  const body = req.body as { version?: unknown };
  const version =
    typeof body.version === "string" && body.version.trim()
      ? body.version.trim()
      : CURRENT_POLICY_VERSION;

  if (version !== CURRENT_POLICY_VERSION) {
    res.status(400).json({ error: "Unsupported policy version" });
    return;
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      legalAcceptedAt: new Date(),
      legalVersion: version,
    },
    select: { email: true },
  });

  await logAuditEvent({
    action: "legal_acceptance",
    actorEmail: user.email,
    organizationId: userId,
    targetType: "user",
    targetId: userId,
    metadata: { version },
  });

  res.json({ ok: true, legalAcceptedAt: new Date().toISOString(), legalVersion: version });
});

/** PATCH /api/organization/marketing-preferences */
organizationRouter.patch("/marketing-preferences", async (req, res) => {
  const userId = req.user!.userId;
  const body = req.body as { optOut?: unknown };
  if (typeof body.optOut !== "boolean") {
    res.status(400).json({ error: "optOut must be a boolean" });
    return;
  }
  await prisma.user.update({
    where: { id: userId },
    data: { marketingEmailsOptOut: body.optOut },
  });
  res.json({ ok: true, marketingEmailsOptOut: body.optOut });
});

/** POST /api/organization/delete-account — schedule seller account erasure. */
organizationRouter.post("/delete-account", async (req, res) => {
  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, deletedAt: true },
  });
  if (!user || user.deletedAt) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  const { scheduleSellerAccountErasure } = await import("../lib/accountErasure");
  const result = await scheduleSellerAccountErasure({
    userId,
    actorEmail: user.email,
    reason: "seller_self_service",
  });

  res.json({
    ok: true,
    erasureScheduledAt: result.erasureScheduledAt.toISOString(),
  });
});

/** POST /api/organization/cancel-account-deletion — cancel pending erasure. */
organizationRouter.post("/cancel-account-deletion", async (req, res) => {
  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, erasureScheduledAt: true },
  });
  if (!user?.erasureScheduledAt) {
    res.status(400).json({ error: "No pending account deletion" });
    return;
  }

  const { cancelScheduledAccountErasure } = await import("../lib/accountErasure");
  await cancelScheduledAccountErasure({ userId, actorEmail: user.email });
  res.json({ ok: true });
});

/** GET /api/organization/export — export seller account data. */
organizationRouter.get("/export", async (req, res) => {
  const userId = req.user!.userId;
  const [user, org, orders, events, storefronts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        legalAcceptedAt: true,
        legalVersion: true,
      },
    }),
    prisma.organization.findUnique({ where: { id: userId } }),
    prisma.order.findMany({
      where: { organizationId: userId },
      take: 5000,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        totalPrice: true,
        currency: true,
        createdAt: true,
        contextType: true,
      },
    }),
    prisma.event.findMany({ where: { userId }, select: { id: true, name: true, startDate: true, endDate: true } }),
    prisma.storefront.findMany({ where: { userId }, select: { id: true, name: true, isActive: true } }),
  ]);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await logAuditEvent({
    action: "seller_data_exported",
    actorEmail: user.email,
    organizationId: userId,
    targetType: "user",
    targetId: userId,
  });

  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="magnetoo-account-export.json"`,
  );
  res.send(
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        user,
        organization: org,
        orders,
        events,
        storefronts,
      },
      null,
      2,
    ),
  );
});
