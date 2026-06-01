import { Router } from "express";
import { prisma } from "../lib/prisma";
import { canAcceptOrders } from "../lib/event";
import { canStorefrontAcceptOrders } from "../lib/storefront";
import {
  BUYER_EVENT_ORDER_LIMIT_MESSAGE,
  BUYER_STORE_ORDER_LIMIT_MESSAGE,
  canOrganizationAcceptOrders,
  ORDER_LIMIT_REACHED,
} from "../lib/saas";

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

    const [pricingCount, shapeCount] = await Promise.all([
      prisma.pricing.count({
        where: { contextType: "EVENT", contextId: event.id, deletedAt: null },
      }),
      prisma.allowedShape.count({
        where: { contextType: "EVENT", contextId: event.id },
      }),
    ]);

    const orderCheck = canAcceptOrders(event, pricingCount, shapeCount);
    if (!orderCheck.ok) {
      res.json({
        name: event.name,
        canOrder: false,
        unavailableReason: orderCheck.reason,
        unavailableCode: null,
      });
      return;
    }

    const orgLimit = await canOrganizationAcceptOrders(event.userId);
    if (!orgLimit.ok) {
      res.json({
        name: event.name,
        canOrder: false,
        unavailableReason: BUYER_EVENT_ORDER_LIMIT_MESSAGE,
        unavailableCode: ORDER_LIMIT_REACHED,
      });
      return;
    }

    res.json({
      name: event.name,
      canOrder: true,
      unavailableReason: null,
      unavailableCode: null,
    });
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

    const [pricingCount, shapeCount] = await Promise.all([
      prisma.pricing.count({
        where: { contextType: "STOREFRONT", contextId: storefront.id, deletedAt: null },
      }),
      prisma.allowedShape.count({
        where: { contextType: "STOREFRONT", contextId: storefront.id },
      }),
    ]);

    const orderCheck = canStorefrontAcceptOrders(
      storefront,
      pricingCount,
      shapeCount,
    );
    if (!orderCheck.ok) {
      res.json({
        name: storefront.name,
        canOrder: false,
        unavailableReason: orderCheck.reason,
        unavailableCode: null,
      });
      return;
    }

    const orgLimit = await canOrganizationAcceptOrders(storefront.userId);
    if (!orgLimit.ok) {
      res.json({
        name: storefront.name,
        canOrder: false,
        unavailableReason: BUYER_STORE_ORDER_LIMIT_MESSAGE,
        unavailableCode: ORDER_LIMIT_REACHED,
      });
      return;
    }

    res.json({
      name: storefront.name,
      canOrder: true,
      unavailableReason: null,
      unavailableCode: null,
    });
    return;
  }

  res.status(400).json({ error: "Invalid context type" });
});
