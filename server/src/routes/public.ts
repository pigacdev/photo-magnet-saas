import { Router } from "express";
import { prisma } from "../lib/prisma";
import { canAcceptOrders } from "../lib/event";
import {
  canStorefrontAcceptOrders,
  isVacationActive,
  vacationPublicPayload,
  VACATION_MODE_CODE,
} from "../lib/storefront";
import {
  isOrganizationCurrencyConfigured,
  SELLER_CURRENCY_NOT_CONFIGURED_MESSAGE,
  SELLER_SETUP_INCOMPLETE_CODE,
} from "../lib/organizationCurrency";
import {
  BUYER_EVENT_ORDER_LIMIT_MESSAGE,
  BUYER_STORE_ORDER_LIMIT_MESSAGE,
  canOrganizationAcceptOrders,
  ORDER_LIMIT_REACHED,
} from "../lib/saas";
import { withBannerCacheBust } from "../lib/eventBannerStorage";

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

    const currencyReady = await isOrganizationCurrencyConfigured(event.userId);
    if (!currencyReady) {
      res.json({
        name: event.name,
        bannerUrl: withBannerCacheBust(event.bannerUrl, event.updatedAt),
        canOrder: false,
        unavailableReason: SELLER_CURRENCY_NOT_CONFIGURED_MESSAGE,
        unavailableCode: SELLER_SETUP_INCOMPLETE_CODE,
      });
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
        bannerUrl: withBannerCacheBust(event.bannerUrl, event.updatedAt),
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
        bannerUrl: withBannerCacheBust(event.bannerUrl, event.updatedAt),
        canOrder: false,
        unavailableReason: BUYER_EVENT_ORDER_LIMIT_MESSAGE,
        unavailableCode: ORDER_LIMIT_REACHED,
      });
      return;
    }

    res.json({
      name: event.name,
      bannerUrl: withBannerCacheBust(event.bannerUrl, event.updatedAt),
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

    const currencyReady = await isOrganizationCurrencyConfigured(storefront.userId);
    if (!currencyReady) {
      res.json({
        name: storefront.name,
        canOrder: false,
        unavailableReason: SELLER_CURRENCY_NOT_CONFIGURED_MESSAGE,
        unavailableCode: SELLER_SETUP_INCOMPLETE_CODE,
      });
      return;
    }

    const [pricingCount, shapeCount, org] = await Promise.all([
      prisma.pricing.count({
        where: { contextType: "STOREFRONT", contextId: storefront.id, deletedAt: null },
      }),
      prisma.allowedShape.count({
        where: { contextType: "STOREFRONT", contextId: storefront.id },
      }),
      prisma.organization.findUnique({
        where: { id: storefront.userId },
        select: { plan: true },
      }),
    ]);

    const plan = org?.plan ?? "FREE";

    const orderCheck = canStorefrontAcceptOrders(
      storefront,
      pricingCount,
      shapeCount,
      plan,
    );
    if (!orderCheck.ok) {
      const vacationActive = isVacationActive(storefront, plan);
      res.json({
        name: storefront.name,
        canOrder: false,
        unavailableReason: orderCheck.reason,
        unavailableCode: vacationActive ? VACATION_MODE_CODE : null,
        ...(vacationActive && {
          vacation: vacationPublicPayload(storefront),
        }),
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
