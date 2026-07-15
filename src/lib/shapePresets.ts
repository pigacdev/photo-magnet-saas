import { formatShapePresetLabel, type SizeUnit } from "@/lib/magnetSize";

export type ShapeInput = {
  shapeType: "SQUARE" | "CIRCLE" | "RECTANGLE";
  widthMm: number;
  heightMm: number;
};

/**
 * `productionValidated` marks shapes whose print template has been physically
 * verified on a real cutter/die. Only validated shapes may be offered to sellers
 * and rendered into print PDFs. Keep this in sync with the server allowlist in
 * `server/src/lib/validatedShapes.ts`.
 */
export type ShapePreset = ShapeInput & { productionValidated: boolean };

export const SHAPE_PRESET_VALUES: ShapePreset[] = [
  { shapeType: "SQUARE", widthMm: 50, heightMm: 50, productionValidated: true },
  { shapeType: "SQUARE", widthMm: 63, heightMm: 63, productionValidated: false },
  { shapeType: "CIRCLE", widthMm: 50, heightMm: 50, productionValidated: false },
  { shapeType: "RECTANGLE", widthMm: 50, heightMm: 70, productionValidated: false },
];

export function getShapePresets(
  unit: SizeUnit = "mm",
): { label: string; value: ShapeInput; available: boolean }[] {
  return SHAPE_PRESET_VALUES.map(({ productionValidated, ...value }) => ({
    label: formatShapePresetLabel(value, unit),
    value,
    available: productionValidated,
  }));
}

/** @deprecated Use getShapePresets(unit) for display labels. */
export const SHAPE_PRESETS = getShapePresets("mm");

export function shapePresetKey(s: ShapeInput): string {
  return `${s.shapeType}-${s.widthMm}-${s.heightMm}`;
}

export function shapeRecordKey(s: {
  shapeType: string;
  widthMm: number;
  heightMm: number;
}): string {
  return `${s.shapeType}-${s.widthMm}-${s.heightMm}`;
}

/** True only for shapes whose print template is physically validated. */
export function isProductionValidatedShape(s: {
  shapeType: string;
  widthMm: number;
  heightMm: number;
}): boolean {
  const key = shapeRecordKey(s);
  return SHAPE_PRESET_VALUES.some(
    (preset) => preset.productionValidated && shapePresetKey(preset) === key,
  );
}

/** Keys for production-validated shapes attached to an event/storefront. */
export function productionValidatedShapeKeys(
  shapes: { shapeType: string; widthMm: number; heightMm: number }[],
): Set<string> {
  return new Set(
    shapes.filter(isProductionValidatedShape).map((s) => shapeRecordKey(s)),
  );
}

export function hasUnvalidatedAllowedShapes(
  shapes: { shapeType: string; widthMm: number; heightMm: number }[],
): boolean {
  return shapes.some((s) => !isProductionValidatedShape(s));
}
