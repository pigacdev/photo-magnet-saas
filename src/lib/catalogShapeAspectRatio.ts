import type { CatalogShape } from "@/lib/orderSessionTypes";

/**
 * Frame aspect ratio for a magnet shape (width / height), same as the fixed crop UI.
 * Circle / square → 1:1; rectangle → widthMm / heightMm.
 */
export function catalogShapeAspectRatio(shape: CatalogShape): number {
  const t = shape.shapeType.toUpperCase();
  if (t === "RECTANGLE") {
    const ar = shape.widthMm / shape.heightMm;
    return ar > 0 ? ar : 1;
  }
  return 1;
}
