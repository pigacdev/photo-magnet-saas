import { Router } from "express";
import { prisma } from "../lib/prisma";
import { normalizeBrandTextInput } from "../lib/brandTextForOrder";
import {
  enrichStorefront,
  isStorefrontConfigurationComplete,
  parseVacationModeInput,
} from "../lib/storefront";
import { parseMaxMagnetsPerOrderInput } from "../lib/validateMaxMagnetsPerOrderInput";
import { parsePickupAddressInput } from "../lib/parsePickupAddressInput";
import {
  parseNotificationEmailInput,
  parseSendOrderEmailsInput,
} from "../lib/parseOrderNotificationSettings";
import { planHasFeature } from "../lib/planCatalog";
import { featureRequiredMessage } from "../lib/planFeatures";

async function sellerPlan(userId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: userId },
    select: { plan: true },
  });
  return org?.plan ?? "FREE";
}

export const storefrontsRouter = Router();

storefrontsRouter.get("/", async (req, res) => {
  const userId = req.user!.userId;
  const plan = await sellerPlan(userId);

  const storefronts = await prisma.storefront.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  const enriched = storefronts.map((sf) => ({ ...sf, ...enrichStorefront(sf, plan) }));

  res.json({ storefronts: enriched });
});

storefrontsRouter.post("/", async (req, res) => {
  const userId = req.user!.userId;
  const { name, maxMagnetsPerOrder, brandText, notificationEmail, sendOrderEmails, pickupAddress } =
    req.body as {
      name?: unknown;
      maxMagnetsPerOrder?: unknown;
      brandText?: unknown;
      notificationEmail?: unknown;
      sendOrderEmails?: unknown;
      pickupAddress?: unknown;
    };

  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  const existingCount = await prisma.storefront.count({
    where: { userId, deletedAt: null },
  });
  if (existingCount >= 1) {
    res.status(409).json({ error: "Organization already has a storefront" });
    return;
  }

  let maxMagnets: number | null | undefined;
  if (maxMagnetsPerOrder !== undefined) {
    const parsed = parseMaxMagnetsPerOrderInput(maxMagnetsPerOrder);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    maxMagnets = parsed.value;
  }

  const createPlan = await sellerPlan(userId);

  const brandNorm = normalizeBrandTextInput(brandText);
  if (brandNorm.kind === "error") {
    res.status(400).json({ error: brandNorm.error });
    return;
  }
  if (
    brandNorm.kind !== "omit" &&
    !planHasFeature(createPlan, "custom_branding")
  ) {
    res.status(403).json({ error: featureRequiredMessage("custom_branding") });
    return;
  }
  const brandCreate =
    brandNorm.kind === "omit" ? {} : { brandText: brandNorm.value };

  const notifEmail = parseNotificationEmailInput(notificationEmail);
  if (notifEmail.kind === "error") {
    res.status(400).json({ error: notifEmail.error });
    return;
  }
  const notifSend = parseSendOrderEmailsInput(sendOrderEmails);
  if (notifSend.kind === "error") {
    res.status(400).json({ error: notifSend.error });
    return;
  }
  const notifCreate = {
    ...(notifEmail.kind === "ok" && { notificationEmail: notifEmail.value }),
    ...(notifSend.kind === "ok" && { sendOrderEmails: notifSend.value }),
  };

  const pickupNorm = parsePickupAddressInput(pickupAddress);
  if (pickupNorm.kind === "error") {
    res.status(400).json({ error: pickupNorm.error });
    return;
  }
  const pickupCreate =
    pickupNorm.kind === "omit"
      ? {}
      : { pickupAddress: pickupNorm.value };

  const storefront = await prisma.storefront.create({
    data: {
      userId,
      name: name.trim(),
      ...(maxMagnets !== undefined && { maxMagnetsPerOrder: maxMagnets }),
      ...brandCreate,
      ...notifCreate,
      ...pickupCreate,
    },
  });

  res.status(201).json({
    storefront: { ...storefront, ...enrichStorefront(storefront, createPlan) },
  });
});

storefrontsRouter.get("/:id", async (req, res) => {
  const userId = req.user!.userId;
  const { id } = req.params;
  const plan = await sellerPlan(userId);

  const storefront = await prisma.storefront.findUnique({
    where: { id, userId, deletedAt: null },
  });

  if (!storefront) {
    res.status(404).json({ error: "Storefront not found" });
    return;
  }

  const shapes = await prisma.allowedShape.findMany({
    where: { contextType: "STOREFRONT", contextId: storefront.id },
    orderBy: { displayOrder: "asc" },
  });

  const pricing = await prisma.pricing.findMany({
    where: { contextType: "STOREFRONT", contextId: storefront.id, deletedAt: null },
    orderBy: { displayOrder: "asc" },
  });

  res.json({
    storefront: {
      ...storefront,
      ...enrichStorefront(storefront, plan),
      shapes,
      pricing,
      configurationComplete: isStorefrontConfigurationComplete(shapes.length, pricing.length),
    },
  });
});

storefrontsRouter.patch("/:id", async (req, res) => {
  const userId = req.user!.userId;
  const { id } = req.params;
  const {
    name,
    isActive,
    maxMagnetsPerOrder,
    brandText,
    notificationEmail,
    sendOrderEmails,
    pickupAddress,
    vacationFrom,
    vacationTo,
    vacationNote,
  } = req.body as {
    name?: unknown;
    isActive?: unknown;
    maxMagnetsPerOrder?: unknown;
    brandText?: unknown;
    notificationEmail?: unknown;
    sendOrderEmails?: unknown;
    pickupAddress?: unknown;
    vacationFrom?: unknown;
    vacationTo?: unknown;
    vacationNote?: unknown;
  };

  const existing = await prisma.storefront.findUnique({
    where: { id, userId, deletedAt: null },
  });

  if (!existing) {
    res.status(404).json({ error: "Storefront not found" });
    return;
  }

  let maxMagnetsUpdate: number | null | undefined;
  if (maxMagnetsPerOrder !== undefined) {
    const parsed = parseMaxMagnetsPerOrderInput(maxMagnetsPerOrder);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    maxMagnetsUpdate = parsed.value;
  }

  const patchPlan = await sellerPlan(userId);

  const hasVacationFields =
    vacationFrom !== undefined || vacationTo !== undefined || vacationNote !== undefined;
  let vacationPatch: {
    vacationFrom?: Date | null;
    vacationTo?: Date | null;
    vacationNote?: string | null;
  } = {};

  if (hasVacationFields) {
    if (!planHasFeature(patchPlan, "vacation_mode")) {
      res.status(403).json({ error: featureRequiredMessage("vacation_mode") });
      return;
    }
    const parsed = parseVacationModeInput({ vacationFrom, vacationTo, vacationNote });
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    vacationPatch = {
      vacationFrom: parsed.from,
      vacationTo: parsed.to,
      vacationNote: parsed.note,
    };
  }

  const brandNorm = normalizeBrandTextInput(brandText);
  if (brandNorm.kind === "error") {
    res.status(400).json({ error: brandNorm.error });
    return;
  }
  if (
    brandNorm.kind !== "omit" &&
    !planHasFeature(patchPlan, "custom_branding")
  ) {
    res.status(403).json({ error: featureRequiredMessage("custom_branding") });
    return;
  }
  const brandPatch =
    brandNorm.kind === "omit" ? {} : { brandText: brandNorm.value };

  const notifEmail = parseNotificationEmailInput(notificationEmail);
  if (notifEmail.kind === "error") {
    res.status(400).json({ error: notifEmail.error });
    return;
  }
  const notifSend = parseSendOrderEmailsInput(sendOrderEmails);
  if (notifSend.kind === "error") {
    res.status(400).json({ error: notifSend.error });
    return;
  }
  const notifPatch = {
    ...(notifEmail.kind === "ok" && { notificationEmail: notifEmail.value }),
    ...(notifSend.kind === "ok" && { sendOrderEmails: notifSend.value }),
  };

  const pickupNorm = parsePickupAddressInput(pickupAddress);
  if (pickupNorm.kind === "error") {
    res.status(400).json({ error: pickupNorm.error });
    return;
  }
  const pickupPatch =
    pickupNorm.kind === "omit"
      ? {}
      : { pickupAddress: pickupNorm.value };

  const storefront = await prisma.storefront.update({
    where: { id },
    data: {
      ...(typeof name === "string" && { name: name.trim() }),
      ...(typeof isActive === "boolean" && { isActive }),
      ...(maxMagnetsUpdate !== undefined && { maxMagnetsPerOrder: maxMagnetsUpdate }),
      ...brandPatch,
      ...notifPatch,
      ...pickupPatch,
      ...vacationPatch,
    },
  });

  const shapes = await prisma.allowedShape.findMany({
    where: { contextType: "STOREFRONT", contextId: storefront.id },
    orderBy: { displayOrder: "asc" },
  });

  const pricing = await prisma.pricing.findMany({
    where: { contextType: "STOREFRONT", contextId: storefront.id, deletedAt: null },
    orderBy: { displayOrder: "asc" },
  });

  res.json({
    storefront: {
      ...storefront,
      ...enrichStorefront(storefront, patchPlan),
      shapes,
      pricing,
      configurationComplete: isStorefrontConfigurationComplete(shapes.length, pricing.length),
    },
  });
});

storefrontsRouter.delete("/:id", async (req, res) => {
  const userId = req.user!.userId;
  const { id } = req.params;

  if (req.user!.role !== "ADMIN") {
    res.status(403).json({ error: "Only admins can delete storefronts" });
    return;
  }

  const existing = await prisma.storefront.findUnique({
    where: { id, userId, deletedAt: null },
  });

  if (!existing) {
    res.status(404).json({ error: "Storefront not found" });
    return;
  }

  await prisma.storefront.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  res.json({ success: true });
});

// --- AllowedShape sub-routes (same pattern as events) ---

storefrontsRouter.post("/:id/shapes", async (req, res) => {
  const userId = req.user!.userId;
  const { id } = req.params;
  const { shapeType, widthMm, heightMm } = req.body;

  const storefront = await prisma.storefront.findUnique({
    where: { id, userId, deletedAt: null },
  });

  if (!storefront) {
    res.status(404).json({ error: "Storefront not found" });
    return;
  }

  if (!shapeType || !widthMm || !heightMm) {
    res.status(400).json({ error: "shapeType, widthMm, and heightMm are required" });
    return;
  }

  if (widthMm <= 0 || heightMm <= 0) {
    res.status(400).json({ error: "widthMm and heightMm must be greater than 0" });
    return;
  }

  const maxOrder = await prisma.allowedShape.findFirst({
    where: { contextType: "STOREFRONT", contextId: id },
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  });

  const shape = await prisma.allowedShape.create({
    data: {
      contextType: "STOREFRONT",
      contextId: id,
      shapeType,
      widthMm,
      heightMm,
      displayOrder: (maxOrder?.displayOrder ?? -1) + 1,
    },
  });

  res.status(201).json({ shape });
});

storefrontsRouter.delete("/:id/shapes/:shapeId", async (req, res) => {
  const userId = req.user!.userId;
  const { id, shapeId } = req.params;

  const storefront = await prisma.storefront.findUnique({
    where: { id, userId, deletedAt: null },
  });

  if (!storefront) {
    res.status(404).json({ error: "Storefront not found" });
    return;
  }

  const shape = await prisma.allowedShape.findUnique({
    where: { id: shapeId },
  });

  if (!shape || shape.contextId !== id || shape.contextType !== "STOREFRONT") {
    res.status(404).json({ error: "Shape not found" });
    return;
  }

  const count = await prisma.allowedShape.count({
    where: { contextType: "STOREFRONT", contextId: id },
  });

  if (count <= 1) {
    res.status(400).json({ error: "Storefront must have at least one shape" });
    return;
  }

  await prisma.allowedShape.delete({ where: { id: shapeId } });

  const remaining = await prisma.allowedShape.findMany({
    where: { contextType: "STOREFRONT", contextId: id },
    orderBy: { displayOrder: "asc" },
  });

  await Promise.all(
    remaining.map((s, i) =>
      prisma.allowedShape.update({
        where: { id: s.id },
        data: { displayOrder: i },
      }),
    ),
  );

  res.json({ success: true });
});
