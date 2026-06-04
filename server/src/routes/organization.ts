import { Router } from "express";
import { CURRENCY_OPTIONS } from "../lib/currency";
import {
  organizationHasCommittedOrders,
  patchOrganizationCurrency,
} from "../lib/organizationCurrency";
import { prisma } from "../lib/prisma";

export const organizationRouter = Router();

organizationRouter.get("/settings", async (req, res) => {
  const userId = req.user!.userId;

  const org = await prisma.organization.findUnique({
    where: { id: userId },
    select: { currency: true, initialSetupAt: true },
  });

  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  const hasOrders = await organizationHasCommittedOrders(userId);
  const currencyLocked = org.currency != null;

  res.json({
    currency: org.currency,
    initialSetupAt: org.initialSetupAt?.toISOString() ?? null,
    currencyLocked,
    hasOrders,
    supportedCurrencies: CURRENCY_OPTIONS,
  });
});

organizationRouter.patch("/settings", async (req, res) => {
  const userId = req.user!.userId;
  const { currency: rawCurrency } = req.body as { currency?: unknown };

  if (typeof rawCurrency !== "string" || !rawCurrency.trim()) {
    res.status(400).json({ error: "currency is required" });
    return;
  }

  const result = await patchOrganizationCurrency(userId, rawCurrency);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const org = await prisma.organization.findUnique({
    where: { id: userId },
    select: { currency: true, initialSetupAt: true },
  });

  const hasOrders = await organizationHasCommittedOrders(userId);

  res.json({
    currency: org?.currency ?? result.currency,
    initialSetupAt: org?.initialSetupAt?.toISOString() ?? null,
    currencyLocked: (org?.currency ?? result.currency) != null,
    hasOrders,
  });
});
