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
  /** min(magnet count from pricing, effective per-order cap). From GET/PATCH /api/session. */
  maxImagesAllowed: number;
  /** Per-item: cap for quantity input. Bundle: system cap (unused in bundle UI). */
  maxMagnetsAllowed: number;
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

export type SessionImage = {
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
  cropX: number | null;
  cropY: number | null;
  cropWidth: number | null;
  cropHeight: number | null;
  cropScale: number | null;
  cropTranslateX: number | null;
  cropTranslateY: number | null;
  cropRotation: number;
};

export type GetSessionImagesResponse = {
  images: SessionImage[];
  /** Present when the cookie session is missing, expired, or no longer valid. */
  error?: "SESSION_INVALID";
};

export type PostSessionImagesResponse = {
  images: SessionImage[];
  errors?: { filename: string; error: string }[];
};

/** POST /api/orders — Phase 5F order commit. */
export type PostOrderCommitResponse = {
  orderId: string;
  status: "PENDING_CASH" | "PENDING_PAYMENT";
};

/** GET /api/orders/:id — session-scoped order status (e.g. payment polling) + customer prefill + summary. */
export type GetOrderStatusResponse = {
  orderId: string;
  status: "PENDING_CASH" | "PENDING_PAYMENT" | "PAID";
  contextType?: "EVENT" | "STOREFRONT";
  customerName?: string | null;
  customerPhone?: string | null;
  shippingType?: string | null;
  shippingAddress?: unknown | null;
  totalPrice?: string;
  currency?: string;
  imageCount?: number;
};
