/** User-facing rotation in degrees clockwise (0, 90, 180, 270). */
export type NormalizedRotation = 0 | 90 | 180 | 270;

/** Snap to nearest 90° clockwise step. */
export function normalizeRotation(deg: number): NormalizedRotation {
  if (!Number.isFinite(deg)) return 0;
  const n = ((((Math.round(deg / 90) * 90) % 360) + 360) % 360) as NormalizedRotation;
  return n;
}

/**
 * Pixel dimensions after applying user rotation (post-rotation image space).
 * Crop rects are stored in this coordinate system.
 */
export function effectiveImageDimensions(
  originalW: number,
  originalH: number,
  rotationDeg: number,
): { w: number; h: number } {
  const rot = normalizeRotation(rotationDeg);
  if (rot === 90 || rot === 270) {
    return { w: originalH, h: originalW };
  }
  return { w: originalW, h: originalH };
}

/** Axis-aligned bbox of the scaled image after CSS-style clockwise rotation. */
export function rotatedImageBBox(
  originalW: number,
  originalH: number,
  k: number,
  rotationDeg: number,
): { width: number; height: number } {
  const rot = normalizeRotation(rotationDeg);
  const rad = (rot * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    width: k * (originalW * cos + originalH * sin),
    height: k * (originalW * sin + originalH * cos),
  };
}

/** Sharp `.rotate()` uses CCW-positive angles; cropRotation is CW. */
export function sharpRotateFromCropRotation(cwRotationDeg: number): number {
  const rot = normalizeRotation(cwRotationDeg);
  if (rot === 0) return 0;
  return 360 - rot;
}
