/**
 * Fixed-frame crop: frame size in CSS px, image in original pixels.
 * Crop = print: rectangle in post-rotation image space (see cropRotation.ts).
 */

import {
  effectiveImageDimensions,
  rotatedImageBBox,
} from "@/lib/cropRotation";

/** Max zoom relative to minimum cover (matches product guideline ~3–4×). */
export const MAX_CROP_ZOOM_FACTOR = 4;

/** Minimum cover scale: image at this uniform scale fills the frame with no empty space. */
export function minCoverScale(
  frameW: number,
  frameH: number,
  originalW: number,
  originalH: number,
  rotationDeg = 0,
): number {
  if (originalW <= 0 || originalH <= 0 || frameW <= 0 || frameH <= 0) return 1;
  const { w, h } = effectiveImageDimensions(
    originalW,
    originalH,
    rotationDeg,
  );
  return Math.max(frameW / w, frameH / h);
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
 * Crop rect is in post-rotation image pixel space.
 */
export function computeCropPixelRect(
  originalW: number,
  originalH: number,
  frameW: number,
  frameH: number,
  tx: number,
  ty: number,
  k: number,
  rotationDeg = 0,
): CropPixelRect {
  const { w: effW, h: effH } = effectiveImageDimensions(
    originalW,
    originalH,
    rotationDeg,
  );

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

  const rot = ((rotationDeg % 360) + 360) % 360;
  let cropX: number;
  let cropY: number;
  let cropWidth: number;
  let cropHeight: number;

  if (rot === 0) {
    cropX = Math.round(x0);
    cropY = Math.round(y0);
    cropWidth = Math.max(1, Math.round(x1 - x0));
    cropHeight = Math.max(1, Math.round(y1 - y0));
  } else if (rot === 90) {
    cropX = Math.round(y0);
    cropY = Math.round(originalW - x1);
    cropWidth = Math.max(1, Math.round(y1 - y0));
    cropHeight = Math.max(1, Math.round(x1 - x0));
  } else if (rot === 180) {
    cropX = Math.round(originalW - x1);
    cropY = Math.round(originalH - y1);
    cropWidth = Math.max(1, Math.round(x1 - x0));
    cropHeight = Math.max(1, Math.round(y1 - y0));
  } else {
    cropX = Math.round(originalH - y1);
    cropY = Math.round(x0);
    cropWidth = Math.max(1, Math.round(y1 - y0));
    cropHeight = Math.max(1, Math.round(x1 - x0));
  }

  cropX = Math.max(0, Math.min(cropX, effW - 1));
  cropY = Math.max(0, Math.min(cropY, effH - 1));
  cropWidth = Math.max(1, Math.min(cropWidth, effW - cropX));
  cropHeight = Math.max(1, Math.min(cropHeight, effH - cropY));

  return { cropX, cropY, cropWidth, cropHeight };
}

/** Clamp pan so the rotated scaled image still fully covers the frame. */
export function clampPan(
  originalW: number,
  originalH: number,
  frameW: number,
  frameH: number,
  k: number,
  tx: number,
  ty: number,
  rotationDeg = 0,
): { tx: number; ty: number } {
  const { width: bboxW, height: bboxH } = rotatedImageBBox(
    originalW,
    originalH,
    k,
    rotationDeg,
  );
  const halfW = bboxW / 2;
  const halfH = bboxH / 2;
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
  rotationDeg = 0,
): boolean {
  const { width: bboxW, height: bboxH } = rotatedImageBBox(
    originalW,
    originalH,
    k,
    rotationDeg,
  );
  const cx = frameW / 2 + tx;
  const cy = frameH / 2 + ty;
  const left = cx - bboxW / 2;
  const top = cy - bboxH / 2;
  const right = left + bboxW;
  const bottom = top + bboxH;
  const eps = 1e-3;
  return (
    left <= eps &&
    top <= eps &&
    right >= frameW - eps &&
    bottom >= frameH - eps
  );
}
