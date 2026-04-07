import {
  getMinRequiredPx,
  type ShapeMinPxInput,
} from "./minRequiredPxForShape";
import { MIN_PRINT_SIZE } from "./sessionImageLimits";

/** Pass selected allowed shape when recomputing client-side (e.g. tests); API flag wins when set. */
export type SessionImageCropShapeHint = ShapeMinPxInput | undefined;

type LowResImageInput = {
  width: number;
  height: number;
  isLowResolution?: boolean;
};

/**
 * Whether this session image should show the low-quality hint.
 * Prefer server-computed `isLowResolution`.
 * Without it, use `getMinRequiredPx(shape)` when shape is provided; else {@link MIN_PRINT_SIZE}.
 */
export function getIsLowResolution(
  image: LowResImageInput,
  shape?: SessionImageCropShapeHint,
): boolean {
  if (typeof image.isLowResolution === "boolean") {
    return image.isLowResolution;
  }
  if (shape) {
    const req = getMinRequiredPx(shape);
    return image.width < req || image.height < req;
  }
  return image.width < MIN_PRINT_SIZE || image.height < MIN_PRINT_SIZE;
}
