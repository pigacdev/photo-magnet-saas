import type {
  AllowedShape,
  OrderSession,
  Pricing,
  SessionImage,
} from "../../../src/generated/prisma/client";
import type { Response } from "express";
import {
  getSessionCookieClearOptions,
  getSessionCookieSetOptions,
  sessionConfig,
} from "../config/session";
import { getEffectiveMaxMagnetsPerOrder } from "./maxMagnetsPerOrder";
import { getMaxImagesAllowed } from "./sessionImageMaxFromSession";

export type SerializedOrderSession = {
  id: string;
  contextType: "event" | "storefront";
  contextId: string;
  status: "active" | "abandoned" | "converted";
  createdAt: string;
  startedAt: string;
  lastActiveAt: string;
  expiresAt: string;
  selectedShapeId: string | null;
  pricingType: "per_item" | "bundle" | null;
  quantity: number | null;
  bundleId: string | null;
  totalPrice: number | null;
};

export type ApiOrderSession = SerializedOrderSession & {
  maxImagesAllowed: number;
  /** Per-item quantity input max; for bundle sessions equals system cap (not shown in UI). */
  maxMagnetsAllowed: number;
};

export type ApiCatalogShape = {
  id: string;
  shapeType: string;
  widthMm: number;
  heightMm: number;
  displayOrder: number;
};

export type ApiCatalogPricing = {
  id: string;
  type: "per_item" | "bundle";
  price: string;
  quantity: number | null;
  currency: string;
  displayOrder: number | null;
};

export type ApiSessionImage = {
  id: string;
  sessionId: string;
  originalUrl: string;
  width: number;
  height: number;
  fileSize: number;
  status: "uploaded" | "failed";
  position: number;
  isLowResolution: boolean;
  createdAt: string;
};

export function serializeSessionImage(img: SessionImage): ApiSessionImage {
  return {
    id: img.id,
    sessionId: img.sessionId,
    originalUrl: img.originalUrl,
    width: img.width,
    height: img.height,
    fileSize: img.fileSize,
    status: img.status === "UPLOADED" ? "uploaded" : "failed",
    position: img.position,
    isLowResolution: Boolean(img.isLowResolution),
    createdAt: img.createdAt.toISOString(),
  };
}

export function serializeOrderSession(
  session: OrderSession,
): SerializedOrderSession {
  const pt = session.pricingType;
  return {
    id: session.id,
    contextType: session.contextType === "EVENT" ? "event" : "storefront",
    contextId: session.contextId,
    status: session.status.toLowerCase() as SerializedOrderSession["status"],
    createdAt: session.createdAt.toISOString(),
    startedAt: session.startedAt.toISOString(),
    lastActiveAt: session.lastActiveAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    selectedShapeId: session.selectedShapeId ?? null,
    pricingType:
      pt === "PER_ITEM" ? "per_item" : pt === "BUNDLE" ? "bundle" : null,
    quantity: session.quantity ?? null,
    bundleId: session.bundleId ?? null,
    totalPrice:
      session.totalPrice != null ? Number(session.totalPrice) : null,
  };
}

export async function buildOrderSessionResponse(
  session: OrderSession,
): Promise<ApiOrderSession> {
  const base = serializeOrderSession(session);
  const max = await getMaxImagesAllowed(session);
  const maxMagnetsAllowed = await getEffectiveMaxMagnetsPerOrder(session);
  return {
    ...base,
    maxImagesAllowed: max ?? 0,
    maxMagnetsAllowed,
  };
}

export function serializeCatalogShape(s: AllowedShape): ApiCatalogShape {
  return {
    id: s.id,
    shapeType: s.shapeType,
    widthMm: s.widthMm,
    heightMm: s.heightMm,
    displayOrder: s.displayOrder,
  };
}

export function serializeCatalogPricing(p: Pricing): ApiCatalogPricing {
  return {
    id: p.id,
    type: p.type === "PER_ITEM" ? "per_item" : "bundle",
    price: p.price.toString(),
    quantity: p.quantity,
    currency: p.currency,
    displayOrder: p.displayOrder,
  };
}

export function setSessionCookie(res: Response, sessionId: string): void {
  res.cookie(
    sessionConfig.cookieName,
    sessionId,
    getSessionCookieSetOptions(),
  );
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(sessionConfig.cookieName, getSessionCookieClearOptions());
}
