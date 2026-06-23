import {
  DEFAULT_SIZE_UNIT,
  type SizeUnit,
} from "./organizationDisplayPreferences";

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
  options?: { titleCase?: boolean },
): string {
  const dims = formatMagnetDimensions(shape.widthMm, shape.heightMm, unit);
  if (options?.titleCase) {
    const t =
      shape.shapeType.charAt(0) + shape.shapeType.slice(1).toLowerCase();
    return `${t} ${dims}`;
  }
  return `${shape.shapeType} ${dims}`;
}
