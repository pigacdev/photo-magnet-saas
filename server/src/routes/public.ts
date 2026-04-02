import { Router } from "express";
import { prisma } from "../lib/prisma";

export const publicRouter = Router();

/** Public metadata for QR entry pages (title only). */
publicRouter.get("/entry/:contextType/:contextId", async (req, res) => {
  const { contextType, contextId } = req.params;

  if (contextType === "event") {
    const event = await prisma.event.findUnique({
      where: { id: contextId, deletedAt: null },
    });
    if (!event) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ name: event.name });
    return;
  }

  if (contextType === "storefront") {
    const storefront = await prisma.storefront.findUnique({
      where: { id: contextId, deletedAt: null },
    });
    if (!storefront) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ name: storefront.name });
    return;
  }

  res.status(400).json({ error: "Invalid context type" });
});
