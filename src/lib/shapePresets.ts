export type ShapeInput = {
  shapeType: "SQUARE" | "CIRCLE" | "RECTANGLE";
  widthMm: number;
  heightMm: number;
};

export const SHAPE_PRESETS: { label: string; value: ShapeInput }[] = [
  { label: "Square 50×50 mm", value: { shapeType: "SQUARE", widthMm: 50, heightMm: 50 } },
  { label: "Square 63×63 mm", value: { shapeType: "SQUARE", widthMm: 63, heightMm: 63 } },
  { label: "Circle 50×50 mm", value: { shapeType: "CIRCLE", widthMm: 50, heightMm: 50 } },
  { label: "Rectangle 50×70 mm", value: { shapeType: "RECTANGLE", widthMm: 50, heightMm: 70 } },
];

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
