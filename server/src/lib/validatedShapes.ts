/**
 * Server-side allowlist of magnet shapes whose print template has been
 * physically validated on a real cutter/die. Only these may be attached to
 * events/storefronts and rendered into print PDFs.
 *
 * Keep in sync with `src/lib/shapePresets.ts` (`SHAPE_PRESET_VALUES`).
 */

export type ShapeKeyInput = {
  shapeType: string;
  widthMm: number;
  heightMm: number;
};

function shapeRecordKey(s: ShapeKeyInput): string {
  return `${s.shapeType}-${s.widthMm}-${s.heightMm}`;
}

/** Production-validated shapes (currently only the 2x2 in / 50x50 mm square). */
const PRODUCTION_VALIDATED_SHAPE_KEYS = new Set<string>([
  shapeRecordKey({ shapeType: "SQUARE", widthMm: 50, heightMm: 50 }),
]);

export function isProductionValidatedShape(s: ShapeKeyInput): boolean {
  return PRODUCTION_VALIDATED_SHAPE_KEYS.has(shapeRecordKey(s));
}

export function filterProductionValidatedShapes<T extends ShapeKeyInput>(
  shapes: readonly T[],
): T[] {
  return shapes.filter(isProductionValidatedShape);
}
