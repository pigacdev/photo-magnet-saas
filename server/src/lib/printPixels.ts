/**
 * Print pixel math — must match docs/image-processing-and-printing.md (300 DPI).
 * pixels = round((mm / 25.4) * 300)
 */

export const PRINT_DPI = 300;

export function pxFromMm(mm: number): number {
  return Math.round((mm / 25.4) * PRINT_DPI);
}
