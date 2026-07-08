import { Router } from "express";
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
