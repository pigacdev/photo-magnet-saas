/**
 * Fixed-frame crop: frame size in CSS px, image in original pixels.
 * Crop = print: rectangle in original image space only (no percentages).
 */

/** Max zoom relative to minimum cover (matches product guideline ~3–4×). */
export const MAX_CROP_ZOOM_FACTOR = 4;

/** Minimum cover scale: image at this uniform scale fills the frame with no empty space. */
export function minCoverScale(
  frameW: number,
  frameH: number,
  originalW: number,
  originalH: number,
): number {
  if (originalW <= 0 || originalH <= 0 || frameW <= 0 || frameH <= 0) return 1;
  return Math.max(frameW / originalW, frameH / originalH);
}

export function effectiveScale(
  baseScale: number,
  userZoomFactor: number,
): number {
  return baseScale * userZoomFactor;
}

export type CropPixelRect = {
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
};

/**
 * `tx`, `ty` = pan in frame CSS pixels (positive moves image right/down).
 * `k` = uniform scale applied to the full-resolution image (display scale).
 */
export function computeCropPixelRect(
  originalW: number,
  originalH: number,
  frameW: number,
  frameH: number,
  tx: number,
  ty: number,
  k: number,
): CropPixelRect {
  const imgLeft = frameW / 2 + tx - (originalW * k) / 2;
  const imgTop = frameH / 2 + ty - (originalH * k) / 2;
  const left = (0 - imgLeft) / k;
  const right = (frameW - imgLeft) / k;
  const top = (0 - imgTop) / k;
  const bottom = (frameH - imgTop) / k;

  let x0 = Math.min(left, right);
  let x1 = Math.max(left, right);
  let y0 = Math.min(top, bottom);
  let y1 = Math.max(top, bottom);

  x0 = Math.max(0, Math.min(x0, originalW));
  x1 = Math.max(0, Math.min(x1, originalW));
  y0 = Math.max(0, Math.min(y0, originalH));
  y1 = Math.max(0, Math.min(y1, originalH));

  const cropX = Math.round(x0);
  const cropY = Math.round(y0);
  const cropWidth = Math.max(1, Math.round(x1 - x0));
  const cropHeight = Math.max(1, Math.round(y1 - y0));

  return { cropX, cropY, cropWidth, cropHeight };
}

/** Whether the scaled image still fully covers the frame (no empty areas). */
/** Clamp pan so the image still fully covers the frame. */
export function clampPan(
  originalW: number,
  originalH: number,
  frameW: number,
  frameH: number,
  k: number,
  tx: number,
  ty: number,
): { tx: number; ty: number } {
  const halfW = (originalW * k) / 2;
  const halfH = (originalH * k) / 2;
  const minTx = frameW / 2 - halfW;
  const maxTx = -frameW / 2 + halfW;
  const minTy = frameH / 2 - halfH;
  const maxTy = -frameH / 2 + halfH;
  return {
    tx: Math.min(maxTx, Math.max(minTx, tx)),
    ty: Math.min(maxTy, Math.max(minTy, ty)),
  };
}

export function imageCoversFrame(
  originalW: number,
  originalH: number,
  frameW: number,
  frameH: number,
  tx: number,
  ty: number,
  k: number,
): boolean {
  const imgLeft = frameW / 2 + tx - (originalW * k) / 2;
  const imgTop = frameH / 2 + ty - (originalH * k) / 2;
  const imgRight = imgLeft + originalW * k;
  const imgBottom = imgTop + originalH * k;
  const eps = 1e-3;
  return (
    imgLeft <= eps &&
    imgTop <= eps &&
    imgRight >= frameW - eps &&
    imgBottom >= frameH - eps
  );
}
