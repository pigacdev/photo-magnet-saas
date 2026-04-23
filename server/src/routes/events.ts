import { Router } from "express";
import { prisma } from "../lib/prisma";
import { normalizeBrandTextInput } from "../lib/brandTextForOrder";
import { enrichEvent } from "../lib/event";
import { parseMaxMagnetsPerOrderInput } from "../lib/validateMaxMagnetsPerOrderInput";
import {
  parseNotificationEmailInput,
  parseSendOrderEmailsInput,
} from "../lib/parseOrderNotificationSettings";

export const eventsRouter = Router();

eventsRouter.post("/", async (req, res) => {
  const userId = req.user!.userId;
  const {
    name,
    startDate,
    endDate,
    shapes,
    maxMagnetsPerOrder,
    brandText,
    notificationEmail,
    sendOrderEmails,
  } = req.body as {
    name?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    shapes?: unknown;
    maxMagnetsPerOrder?: unknown;
    brandText?: unknown;
    notificationEmail?: unknown;
    sendOrderEmails?: unknown;
  };

  if (
    typeof name !== "string" ||
    !name.trim() ||
    startDate === undefined ||
    startDate === null ||
    endDate === undefined ||
    endDate === null
  ) {
    res.status(400).json({ error: "Name, start date, and end date are required" });
    return;
  }

  const start = new Date(startDate as string | number | Date);
  const end = new Date(endDate as string | number | Date);

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

  if (
    Array.isArray(shapes) &&
    shapes.some(
      (s: { widthMm?: number; heightMm?: number }) =>
        !s.widthMm || !s.heightMm || s.widthMm <= 0 || s.heightMm <= 0,
    )
  ) {
    res.status(400).json({ error: "All shapes must have widthMm and heightMm greater than 0" });
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

  const brandNorm = normalizeBrandTextInput(brandText);
  if (brandNorm.kind === "error") {
    res.status(400).json({ error: brandNorm.error });
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

  const event = await prisma.event.create({
    data: {
      userId,
      name: name.trim(),
      startDate: start,
      endDate: end,
      ...(maxMagnets !== undefined && { maxMagnetsPerOrder: maxMagnets }),
      ...brandCreate,
      ...notifCreate,
    },
  });

  if (Array.isArray(shapes) && shapes.length > 0) {
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
  const {
    name,
    startDate,
    endDate,
    isActive,
    maxMagnetsPerOrder,
    brandText,
    notificationEmail,
    sendOrderEmails,
  } = req.body as Record<string, unknown>;

  const existing = await prisma.event.findUnique({
    where: { id, userId, deletedAt: null },
  });

  if (!existing) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const start = startDate != null && startDate !== "" ? new Date(startDate as string | number | Date) : existing.startDate;
  const end = endDate != null && endDate !== "" ? new Date(endDate as string | number | Date) : existing.endDate;

  if (startDate != null && startDate !== "" && isNaN(start.getTime())) {
    res.status(400).json({ error: "Invalid start date format" });
    return;
  }

  if (endDate != null && endDate !== "" && isNaN(end.getTime())) {
    res.status(400).json({ error: "Invalid end date format" });
    return;
  }

  if (start >= end) {
    res.status(400).json({ error: "Start date must be before end date" });
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

  const brandNorm = normalizeBrandTextInput(brandText);
  if (brandNorm.kind === "error") {
    res.status(400).json({ error: brandNorm.error });
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

  const event = await prisma.event.update({
    where: { id },
    data: {
      ...(typeof name === "string" && { name: name.trim() }),
      ...(startDate != null && startDate !== "" && { startDate: start }),
      ...(endDate != null && endDate !== "" && { endDate: end }),
      ...(typeof isActive === "boolean" && { isActive }),
      ...(maxMagnetsUpdate !== undefined && { maxMagnetsPerOrder: maxMagnetsUpdate }),
      ...brandPatch,
      ...notifPatch,
    },
  });

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
