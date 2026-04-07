import { Router } from "express";
import { prisma } from "../lib/prisma";
import { enrichStorefront } from "../lib/storefront";
import { parseMaxMagnetsPerOrderInput } from "../lib/validateMaxMagnetsPerOrderInput";

export const storefrontsRouter = Router();

storefrontsRouter.get("/", async (req, res) => {
  const userId = req.user!.userId;

  const storefronts = await prisma.storefront.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  const enriched = storefronts.map((sf) => ({ ...sf, ...enrichStorefront(sf) }));

  res.json({ storefronts: enriched });
});

storefrontsRouter.post("/", async (req, res) => {
  const userId = req.user!.userId;
  const { name, maxMagnetsPerOrder } = req.body as {
    name?: unknown;
    maxMagnetsPerOrder?: unknown;
  };

  if (!name || !name.trim()) {
    res.status(400).json({ error: "Name is required" });
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

  const storefront = await prisma.storefront.create({
    data: {
      userId,
      name: name.trim(),
      ...(maxMagnets !== undefined && { maxMagnetsPerOrder: maxMagnets }),
    },
  });

  res.status(201).json({ storefront: { ...storefront, ...enrichStorefront(storefront) } });
});

storefrontsRouter.get("/:id", async (req, res) => {
  const userId = req.user!.userId;
  const { id } = req.params;

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

  res.json({ storefront: { ...storefront, ...enrichStorefront(storefront), shapes, pricing } });
});

storefrontsRouter.patch("/:id", async (req, res) => {
  const userId = req.user!.userId;
  const { id } = req.params;
  const { name, isActive, maxMagnetsPerOrder } = req.body as {
    name?: unknown;
    isActive?: unknown;
    maxMagnetsPerOrder?: unknown;
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

  const storefront = await prisma.storefront.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(isActive !== undefined && { isActive }),
      ...(maxMagnetsUpdate !== undefined && { maxMagnetsPerOrder: maxMagnetsUpdate }),
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
    storefront: { ...storefront, ...enrichStorefront(storefront), shapes, pricing },
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
