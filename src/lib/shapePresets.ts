import { formatShapePresetLabel, type SizeUnit } from "@/lib/magnetSize";

export type ShapeInput = {
  shapeType: "SQUARE" | "CIRCLE" | "RECTANGLE";
  widthMm: number;
  heightMm: number;
};

export const SHAPE_PRESET_VALUES: ShapeInput[] = [
  { shapeType: "SQUARE", widthMm: 50, heightMm: 50 },
  { shapeType: "SQUARE", widthMm: 63, heightMm: 63 },
  { shapeType: "CIRCLE", widthMm: 50, heightMm: 50 },
  { shapeType: "RECTANGLE", widthMm: 50, heightMm: 70 },
];

export function getShapePresets(unit: SizeUnit = "mm"): { label: string; value: ShapeInput }[] {
  return SHAPE_PRESET_VALUES.map((value) => ({
    label: formatShapePresetLabel(value, unit),
    value,
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
