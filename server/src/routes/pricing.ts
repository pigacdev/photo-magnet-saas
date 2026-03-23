import { Router } from "express";
import { prisma } from "../lib/prisma";

export const pricingRouter = Router();

pricingRouter.get("/:contextType/:contextId", async (req, res) => {
  const userId = req.user!.userId;
  const { contextType, contextId } = req.params;

  const ct = contextType.toUpperCase();
  if (ct !== "EVENT" && ct !== "STOREFRONT") {
    res.status(400).json({ error: "Invalid context type" });
    return;
  }

  const ownerCheck = await verifyContextOwnership(ct, contextId, userId);
  if (!ownerCheck.ok) {
    res.status(404).json({ error: ownerCheck.error });
    return;
  }

  const pricing = await prisma.pricing.findMany({
    where: {
      contextType: ct as "EVENT" | "STOREFRONT",
      contextId,
      deletedAt: null,
    },
    orderBy: { displayOrder: "asc" },
  });

  res.json({ pricing });
});

pricingRouter.put("/:contextType/:contextId", async (req, res) => {
  const userId = req.user!.userId;
  const { contextType, contextId } = req.params;
  const { mode, price, bundles } = req.body;

  const ct = contextType.toUpperCase();
  if (ct !== "EVENT" && ct !== "STOREFRONT") {
    res.status(400).json({ error: "Invalid context type" });
    return;
  }

  const ownerCheck = await verifyContextOwnership(ct, contextId, userId);
  if (!ownerCheck.ok) {
    res.status(404).json({ error: ownerCheck.error });
    return;
  }

  if (mode !== "PER_ITEM" && mode !== "BUNDLE") {
    res.status(400).json({ error: "Mode must be PER_ITEM or BUNDLE" });
    return;
  }

  if (mode === "PER_ITEM") {
    if (bundles !== undefined) {
      res.status(400).json({ error: "PER_ITEM mode does not accept bundles" });
      return;
    }

    if (!price || price <= 0) {
      res.status(400).json({ error: "Price must be greater than 0" });
      return;
    }

    await softDeleteExistingPricing(ct as "EVENT" | "STOREFRONT", contextId);

    const created = await prisma.pricing.create({
      data: {
        contextType: ct as "EVENT" | "STOREFRONT",
        contextId,
        type: "PER_ITEM",
        price,
        currency: "EUR",
        displayOrder: null,
      },
    });

    res.json({ pricing: [created] });
    return;
  }

  if (price !== undefined) {
    res.status(400).json({ error: "BUNDLE mode does not accept a single price field" });
    return;
  }

  if (!bundles || !Array.isArray(bundles) || bundles.length === 0) {
    res.status(400).json({ error: "At least one bundle is required" });
    return;
  }

  for (const b of bundles) {
    if (!b.quantity || b.quantity <= 0 || !b.price || b.price <= 0) {
      res.status(400).json({ error: "Each bundle must have quantity and price greater than 0" });
      return;
    }
  }

  const quantities = bundles.map((b: { quantity: number }) => b.quantity);
  if (new Set(quantities).size !== quantities.length) {
    res.status(400).json({ error: "Duplicate bundle quantities are not allowed" });
    return;
  }

  await softDeleteExistingPricing(ct as "EVENT" | "STOREFRONT", contextId);

  bundles.sort((a: { quantity: number }, b: { quantity: number }) => a.quantity - b.quantity);

  const created = await Promise.all(
    bundles.map(
      (b: { quantity: number; price: number }, i: number) =>
        prisma.pricing.create({
          data: {
            contextType: ct as "EVENT" | "STOREFRONT",
            contextId,
            type: "BUNDLE",
            price: b.price,
            quantity: b.quantity,
            currency: "EUR",
            displayOrder: i,
          },
        }),
    ),
  );

  res.json({ pricing: created });
});

pricingRouter.delete("/:contextType/:contextId", async (req, res) => {
  const userId = req.user!.userId;
  const { contextType, contextId } = req.params;

  const ct = contextType.toUpperCase();
  if (ct !== "EVENT" && ct !== "STOREFRONT") {
    res.status(400).json({ error: "Invalid context type" });
    return;
  }

  const ownerCheck = await verifyContextOwnership(ct, contextId, userId);
  if (!ownerCheck.ok) {
    res.status(404).json({ error: ownerCheck.error });
    return;
  }

  await softDeleteExistingPricing(ct as "EVENT" | "STOREFRONT", contextId);

  res.json({ success: true });
});

async function softDeleteExistingPricing(
  contextType: "EVENT" | "STOREFRONT",
  contextId: string,
) {
  await prisma.pricing.updateMany({
    where: { contextType, contextId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}

async function verifyContextOwnership(
  contextType: string,
  contextId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (contextType === "EVENT") {
    const event = await prisma.event.findUnique({
      where: { id: contextId, userId, deletedAt: null },
    });
    if (!event) return { ok: false, error: "Event not found" };
    return { ok: true };
  }

  if (contextType === "STOREFRONT") {
    const storefront = await prisma.storefront.findUnique({
      where: { id: contextId, userId, deletedAt: null },
    });
    if (!storefront) return { ok: false, error: "Storefront not found" };
    return { ok: true };
  }

  return { ok: false, error: "Invalid context type" };
}
