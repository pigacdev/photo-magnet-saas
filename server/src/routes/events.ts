import { Router } from "express";
import { prisma } from "../lib/prisma";
import { enrichEvent } from "../lib/event";

export const eventsRouter = Router();

eventsRouter.post("/", async (req, res) => {
  const userId = req.user!.userId;
  const { name, startDate, endDate, shapes } = req.body;

  if (!name || !startDate || !endDate) {
    res.status(400).json({ error: "Name, start date, and end date are required" });
    return;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    res.status(400).json({ error: "Invalid date format" });
    return;
  }

  if (start >= end) {
    res.status(400).json({ error: "Start date must be before end date" });
    return;
  }

  if (shapes && !Array.isArray(shapes)) {
    res.status(400).json({ error: "Shapes must be an array" });
    return;
  }

  if (shapes && shapes.some((s: { widthMm?: number; heightMm?: number }) => !s.widthMm || !s.heightMm || s.widthMm <= 0 || s.heightMm <= 0)) {
    res.status(400).json({ error: "All shapes must have widthMm and heightMm greater than 0" });
    return;
  }

  const event = await prisma.event.create({
    data: {
      userId,
      name,
      startDate: start,
      endDate: end,
    },
  });

  if (shapes && shapes.length > 0) {
    await prisma.allowedShape.createMany({
      data: shapes.map(
        (
          s: { shapeType: string; widthMm: number; heightMm: number },
          i: number,
        ) => ({
          contextType: "EVENT" as const,
          contextId: event.id,
          shapeType: s.shapeType as "SQUARE" | "CIRCLE" | "RECTANGLE",
          widthMm: s.widthMm,
          heightMm: s.heightMm,
          displayOrder: i,
        }),
      ),
    });
  }

  const allowedShapes = await prisma.allowedShape.findMany({
    where: { contextType: "EVENT", contextId: event.id },
    orderBy: { displayOrder: "asc" },
  });

  res.status(201).json({
    event: { ...event, ...enrichEvent(event), shapes: allowedShapes },
  });
});

eventsRouter.get("/", async (req, res) => {
  const userId = req.user!.userId;

  const events = await prisma.event.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  const eventsWithStatus = events.map((e) => ({
    ...e,
    ...enrichEvent(e),
  }));

  res.json({ events: eventsWithStatus });
});

eventsRouter.get("/:id", async (req, res) => {
  const userId = req.user!.userId;
  const { id } = req.params;

  const event = await prisma.event.findUnique({
    where: { id, userId, deletedAt: null },
  });

  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const shapes = await prisma.allowedShape.findMany({
    where: { contextType: "EVENT", contextId: event.id },
    orderBy: { displayOrder: "asc" },
  });

  const pricing = await prisma.pricing.findMany({
    where: { contextType: "EVENT", contextId: event.id, deletedAt: null },
    orderBy: { displayOrder: "asc" },
  });

  res.json({
    event: { ...event, ...enrichEvent(event), shapes, pricing },
  });
});

eventsRouter.patch("/:id", async (req, res) => {
  const userId = req.user!.userId;
  const { id } = req.params;
  const { name, startDate, endDate, isActive } = req.body;

  const existing = await prisma.event.findUnique({
    where: { id, userId, deletedAt: null },
  });

  if (!existing) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const start = startDate ? new Date(startDate) : existing.startDate;
  const end = endDate ? new Date(endDate) : existing.endDate;

  if (startDate && isNaN(start.getTime())) {
    res.status(400).json({ error: "Invalid start date format" });
    return;
  }

  if (endDate && isNaN(end.getTime())) {
    res.status(400).json({ error: "Invalid end date format" });
    return;
  }

  if (start >= end) {
    res.status(400).json({ error: "Start date must be before end date" });
    return;
  }

  const event = await prisma.event.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(startDate && { startDate: start }),
      ...(endDate && { endDate: end }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  const shapes = await prisma.allowedShape.findMany({
    where: { contextType: "EVENT", contextId: event.id },
    orderBy: { displayOrder: "asc" },
  });

  res.json({
    event: { ...event, ...enrichEvent(event), shapes },
  });
});

eventsRouter.delete("/:id", async (req, res) => {
  const userId = req.user!.userId;
  const { id } = req.params;

  if (req.user!.role !== "ADMIN") {
    res.status(403).json({ error: "Only admins can delete events" });
    return;
  }

  const existing = await prisma.event.findUnique({
    where: { id, userId, deletedAt: null },
  });

  if (!existing) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  await prisma.event.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  res.json({ success: true });
});

// --- AllowedShape sub-routes ---

eventsRouter.post("/:id/shapes", async (req, res) => {
  const userId = req.user!.userId;
  const { id } = req.params;
  const { shapeType, widthMm, heightMm } = req.body;

  const event = await prisma.event.findUnique({
    where: { id, userId, deletedAt: null },
  });

  if (!event) {
    res.status(404).json({ error: "Event not found" });
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
    where: { contextType: "EVENT", contextId: id },
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  });

  const shape = await prisma.allowedShape.create({
    data: {
      contextType: "EVENT",
      contextId: id,
      shapeType,
      widthMm,
      heightMm,
      displayOrder: (maxOrder?.displayOrder ?? -1) + 1,
    },
  });

  res.status(201).json({ shape });
});

eventsRouter.delete("/:id/shapes/:shapeId", async (req, res) => {
  const userId = req.user!.userId;
  const { id, shapeId } = req.params;

  const event = await prisma.event.findUnique({
    where: { id, userId, deletedAt: null },
  });

  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const shape = await prisma.allowedShape.findUnique({
    where: { id: shapeId },
  });

  if (!shape || shape.contextId !== id || shape.contextType !== "EVENT") {
    res.status(404).json({ error: "Shape not found" });
    return;
  }

  const count = await prisma.allowedShape.count({
    where: { contextType: "EVENT", contextId: id },
  });

  if (count <= 1) {
    res.status(400).json({ error: "Event must have at least one shape" });
    return;
  }

  await prisma.allowedShape.delete({ where: { id: shapeId } });

  const remaining = await prisma.allowedShape.findMany({
    where: { contextType: "EVENT", contextId: id },
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
