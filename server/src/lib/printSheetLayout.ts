/** Shared mm → PDF points and A4 grid helpers for print sheets. */

export const mm = (v: number) => v * 2.83465;

export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;
export const PAGE_WIDTH = mm(PAGE_WIDTH_MM);
export const PAGE_HEIGHT = mm(PAGE_HEIGHT_MM);

/** Spacing between rows (vertical); matches legacy square 50×50 layout. */
export const ROW_GAP_MM = 8;
export const rowGap = mm(ROW_GAP_MM);

/** Bleed: +2 mm total per axis (50 mm → 52 mm print image). */
export const BLEED_TOTAL_MM = 2;

/** Octagon blade segment length — matches legacy Square 50×50 print sheet. */
export const OCTAGON_SIDE_MM = 31;

/** Legacy Square 50×50 print image size (mm). */
export const LEGACY_SQUARE50_IMAGE_MM = 52;

/**
 * Margin between print image and outer cut guide (mm), derived from legacy Square 50×50.
 * Same offset used for circle bleed ring and rectangular octagon frames.
 */
export function printFrameMarginMm(): number {
  const octagonSizeMm = OCTAGON_SIDE_MM * (1 + Math.SQRT2);
  return (octagonSizeMm - LEGACY_SQUARE50_IMAGE_MM) / 2;
}

export type PrintSheetShape = {
  shapeType: "SQUARE" | "CIRCLE" | "RECTANGLE";
  widthMm: number;
  heightMm: number;
};

export function isLegacySquare50Layout(shape: PrintSheetShape): boolean {
  return (
    shape.shapeType === "SQUARE" &&
    shape.widthMm === 50 &&
    shape.heightMm === 50
  );
}

export function printImageSizeMm(shape: PrintSheetShape): {
  w: number;
  h: number;
} {
  return {
    w: shape.widthMm + BLEED_TOTAL_MM,
    h: shape.heightMm + BLEED_TOTAL_MM,
  };
}

/** Outer cut-guide bounding box (mm): octagon frame or circle bleed ring. */
export function printFrameSizeMm(shape: PrintSheetShape): {
  w: number;
  h: number;
} {
  const image = printImageSizeMm(shape);
  const pad = printFrameMarginMm() * 2;
  if (shape.shapeType === "CIRCLE") {
    const outer = image.w + pad;
    return { w: outer, h: outer };
  }
  return { w: image.w + pad, h: image.h + pad };
}

export type PrintGrid = {
  cols: number;
  rows: number;
  slotsPerPage: number;
  startY: number;
  colCenters: number[];
  slotW: number;
  slotH: number;
};

/**
 * Two-column grid centered on A4, vertically centered block — same column logic as legacy layout.
 */
export function computePrintGrid(slotW_mm: number, slotH_mm: number): PrintGrid {
  const slotW = mm(slotW_mm);
  const slotH = mm(slotH_mm);
  const cols = 2;

  const maxRows = Math.max(
    1,
    Math.floor((PAGE_HEIGHT + rowGap) / (slotH + rowGap)),
  );
  let rows = maxRows;
  while (rows > 1) {
    const blockH = rows * slotH + (rows - 1) * rowGap;
    if (blockH <= PAGE_HEIGHT) break;
    rows -= 1;
  }

  const totalHeight = rows * slotH + (rows - 1) * rowGap;
  const startY = (PAGE_HEIGHT - totalHeight) / 2;

  const halfWidth = PAGE_WIDTH / 2;
  const colCenters = [halfWidth / 2, halfWidth + halfWidth / 2];

  return {
    cols,
    rows,
    slotsPerPage: cols * rows,
    startY,
    colCenters,
    slotW,
    slotH,
  };
}

export function slotOrigin(
  grid: PrintGrid,
  slotIndex: number,
): { x: number; y: number; col: number; row: number } {
  const col = slotIndex % grid.cols;
  const row = Math.floor(slotIndex / grid.cols);
  const centerX = grid.colCenters[col]!;
  const x = centerX - grid.slotW / 2;
  const y =
    PAGE_HEIGHT - grid.startY - (row + 1) * grid.slotH - row * rowGap;
  return { x, y, col, row };
}
