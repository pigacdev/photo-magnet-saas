import { catalogShapeAspectRatio } from "@/lib/catalogShapeAspectRatio";

export type OrderImageShape = {
  shapeType: string;
  widthMm: number;
  heightMm: number;
};

/** Thumbnail box (px) for a magnet shape; longest side = maxPx. */
export function orderImageThumbSize(
  shape: OrderImageShape,
  maxPx = 132,
): { width: number; height: number } {
  const aspect = catalogShapeAspectRatio(shape);
  if (aspect >= 1) {
    return { width: maxPx, height: Math.round(maxPx / aspect) };
  }
  return { width: Math.round(maxPx * aspect), height: maxPx };
}

export function isCircleOrderShape(shape: OrderImageShape): boolean {
  return shape.shapeType.toUpperCase() === "CIRCLE";
}
