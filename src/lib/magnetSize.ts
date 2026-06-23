export const SIZE_UNITS = ["mm", "cm", "in"] as const;
export type SizeUnit = (typeof SIZE_UNITS)[number];

export const DEFAULT_SIZE_UNIT: SizeUnit = "mm";

export const SIZE_UNIT_OPTIONS: { value: SizeUnit; label: string }[] = [
  { value: "mm", label: "Millimeters (mm)" },
  { value: "cm", label: "Centimeters (cm)" },
  { value: "in", label: "Inches (in)" },
];

function formatUnitValue(mm: number, unit: SizeUnit): string {
  if (unit === "mm") {
    return Number.isInteger(mm) ? String(mm) : mm.toFixed(1).replace(/\.0$/, "");
  }
  if (unit === "cm") {
    const cm = mm / 10;
    return Number.isInteger(cm) ? String(cm) : cm.toFixed(1).replace(/\.0$/, "");
  }
  const inches = mm / 25.4;
  const rounded = Math.round(inches * 10) / 10;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace(/\.0$/, "");
}

export function formatMagnetDimensions(
  widthMm: number,
  heightMm: number,
  unit: SizeUnit = DEFAULT_SIZE_UNIT,
): string {
  const w = formatUnitValue(widthMm, unit);
  const h = formatUnitValue(heightMm, unit);
  return `${w}×${h} ${unit}`;
}

export function formatShapeLabel(
  shape: { shapeType: string; widthMm: number; heightMm: number },
  unit: SizeUnit = DEFAULT_SIZE_UNIT,
): string {
  const t =
    shape.shapeType.charAt(0) + shape.shapeType.slice(1).toLowerCase();
  return `${t} ${formatMagnetDimensions(shape.widthMm, shape.heightMm, unit)}`;
}

export function formatShapePresetLabel(
  shape: { shapeType: string; widthMm: number; heightMm: number },
  unit: SizeUnit = DEFAULT_SIZE_UNIT,
): string {
  return formatShapeLabel(shape, unit);
}

export function getSizeUnitLabel(unit: SizeUnit): string {
  return SIZE_UNIT_OPTIONS.find((o) => o.value === unit)?.label ?? unit;
}

/** e.g. "5×5 cm Square Custom Photo Magnets · 12 magnets" */
export function orderProductLineLabel(
  shape: { shapeType: string; widthMm: number; heightMm: number },
  quantity: number,
  unit: SizeUnit = DEFAULT_SIZE_UNIT,
): string {
  const dims = formatMagnetDimensions(shape.widthMm, shape.heightMm, unit);
  const t =
    shape.shapeType.charAt(0) + shape.shapeType.slice(1).toLowerCase();
  const magnetWord = quantity === 1 ? "magnet" : "magnets";
  return `${dims} ${t} Custom Photo Magnets · ${quantity} ${magnetWord}`;
}
