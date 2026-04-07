import { MIN_PRINT_SIZE } from "./sessionImageLimits";

/**
 * Allowed-shape context for minimum pixel requirement (stub).
 * Full DPI / physical print pipeline is NOT implemented yet.
 */
export type ShapeMinPxInput = {
  shapeType: string;
  widthMm: number;
  heightMm: number;
};

/**
 * Example tier → minimum shorter-side requirement (px) for upload warning.
 * Temporary stub only — not real DPI or bleed math.
 *
 * - circle_small → 800
 * - square_medium → 1000
 * - large_rect → 1200
 */
type StubTier = "circle_small" | "square_medium" | "large_rect" | "default";

const STUB_TIER_MIN_PX: Record<StubTier, number> = {
  circle_small: 800,
  square_medium: 1000,
  large_rect: 1200,
  default: MIN_PRINT_SIZE,
};

/**
 * Coarse classification from shape type + mm until real DPI exists.
 */
function classifyStubTier(shape: ShapeMinPxInput): StubTier {
  const st = shape.shapeType.toUpperCase();
  const maxMm = Math.max(shape.widthMm, shape.heightMm);

  if (st === "CIRCLE") {
    if (maxMm <= 52) return "circle_small";
    return "square_medium";
  }
  if (st === "SQUARE") {
    if (maxMm <= 55) return "circle_small";
    if (maxMm <= 65) return "square_medium";
    return "large_rect";
  }
  if (st === "RECTANGLE") {
    return "large_rect";
  }
  return "default";
}

/**
 * Minimum edge length (px) both width and height must meet for “full quality” at upload.
 * Stub: shape-aware buckets only — replace with DPI pipeline later.
 */
export function getMinRequiredPx(shape: ShapeMinPxInput): number {
  return STUB_TIER_MIN_PX[classifyStubTier(shape)];
}
