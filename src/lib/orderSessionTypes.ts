/** Mirrors GET /api/session JSON (client-side). */
export type OrderSessionPayload = {
  id: string;
  contextType: "event" | "storefront";
  contextId: string;
  status: string;
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

export type CatalogShape = {
  id: string;
  shapeType: string;
  widthMm: number;
  heightMm: number;
  displayOrder: number;
};

export type CatalogPricing = {
  id: string;
  type: "per_item" | "bundle";
  price: string;
  quantity: number | null;
  currency: string;
  displayOrder: number | null;
};

export type GetSessionResponse = {
  session: OrderSessionPayload | null;
  shapes: CatalogShape[];
  pricing: CatalogPricing[];
};
