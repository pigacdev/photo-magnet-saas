import {
  effectiveImageDimensions,
  normalizeRotation,
  sharpRotateFromCropRotation,
} from "@/lib/cropRotation";

/**
 * Draws a crop from post-rotation image space, matching the Sharp render pipeline.
 */
export function drawPostRotationCrop(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource & { width: number; height: number },
  cropX: number,
  cropY: number,
  cropWidth: number,
  cropHeight: number,
  destW: number,
  destH: number,
  rotationDeg: number,
): void {
  const ow =
    "naturalWidth" in img && img.naturalWidth > 0
      ? img.naturalWidth
      : img.width;
  const oh =
    "naturalHeight" in img && img.naturalHeight > 0
      ? img.naturalHeight
      : img.height;
  const rot = normalizeRotation(rotationDeg);
  const { w: effW, h: effH } = effectiveImageDimensions(ow, oh, rot);

  const off = document.createElement("canvas");
  off.width = effW;
  off.height = effH;
  const offCtx = off.getContext("2d");
  if (!offCtx) return;

  const ccw = sharpRotateFromCropRotation(rot);
  offCtx.save();
  offCtx.translate(effW / 2, effH / 2);
  offCtx.rotate((-ccw * Math.PI) / 180);
  offCtx.drawImage(img, -ow / 2, -oh / 2, ow, oh);
  offCtx.restore();

  ctx.drawImage(off, cropX, cropY, cropWidth, cropHeight, 0, 0, destW, destH);
}
