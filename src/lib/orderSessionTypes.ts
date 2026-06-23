/** Mirrors GET /api/session JSON (client-side). */
export type DisplayPreferences = {
  dateFormat: "DMY" | "MDY" | "YMD";
  sizeUnit: "mm" | "cm" | "in";
};

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
  /** Session checkout pipeline (from GET /api/session). */
  checkoutStage?: string;
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
  displayPreferences?: DisplayPreferences;
  storefront?: {
    pickupAddress: {
      street: string;
      houseNumber: string;
      city: string;
      postCode: string;
      country: string;
    } | null;
  } | null;
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

/** POST /api/orders — legacy order commit (Phase 5F). */
export type PostOrderCommitResponse = {
  orderId: string;
  status: string;
};

/** POST /api/session/checkout/validate — session checks only, no order row. */
export type PostSessionCheckoutValidateResponse = {
  ok: true;
  totalPrice: number;
  quantity: number;
};

/** POST /api/orders/finalize — create order after customer submits details. */
export type PostOrderFinalizeResponse = {
  orderId: string;
  status: string;
};

/** sessionStorage: JSON array of { imageId, copies } between review and customer (PER_ITEM). */
export const CHECKOUT_IMAGE_COPIES_STORAGE_KEY = "pm_checkoutImageCopies";

/** GET /api/orders/:id — customer or seller order summary. */
export type GetOrderStatusResponse = {
  orderId: string;
  status: string;
  contextType?: "EVENT" | "STOREFRONT";
  contextId?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  shippingType?: string | null;
  shippingAddress?: unknown | null;
  totalPrice?: string;
  currency?: string;
  imageCount?: number;
};
