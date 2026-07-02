import { degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { mm } from "./printSheetLayout";

const BRAND_COLOR = rgb(0.45, 0.45, 0.45);

/** Max arc span (radians) for curved brand text along the bleed ring. */
const MAX_ARC_RAD = (150 * Math.PI) / 180;

export type CurvedBrandCharPlacement = {
  char: string;
  angleRad: number;
  rotateDeg: number;
};

/**
 * Computes arc angles for each character (left → right along top of circle).
 * Exported for unit tests.
 */
export function computeCurvedBrandPlacements(
  brandText: string,
  charWidths: number[],
  labelRadius: number,
): CurvedBrandCharPlacement[] {
  const totalWidth = charWidths.reduce((sum, w) => sum + w, 0);
  const totalArc = totalWidth / labelRadius;
  let angle = Math.PI / 2 + totalArc / 2;
  const chars = [...brandText];
  const out: CurvedBrandCharPlacement[] = [];

  for (let i = 0; i < chars.length; i++) {
    const cw = charWidths[i]!;
    const charArc = cw / labelRadius;
    angle -= charArc / 2;

    out.push({
      char: chars[i]!,
      angleRad: angle,
      rotateDeg: (angle * 180) / Math.PI - 90,
    });

    angle -= charArc / 2;
  }

  return out;
}

function fitCurvedBrandFontSize(
  labelFont: PDFFont,
  brandText: string,
  labelRadius: number,
): { fontSize: number; charWidths: number[] } {
  let fontSize = 8;
  let totalWidth = labelFont.widthOfTextAtSize(brandText, fontSize);
  let arcAngle = totalWidth / labelRadius;

  while (arcAngle > MAX_ARC_RAD && fontSize > 4) {
    fontSize -= 0.5;
    totalWidth = labelFont.widthOfTextAtSize(brandText, fontSize);
    arcAngle = totalWidth / labelRadius;
  }
  if (arcAngle > MAX_ARC_RAD) {
    fontSize = Math.max(4, fontSize * (MAX_ARC_RAD / arcAngle));
  }

  const chars = [...brandText];
  const charWidths = chars.map((c) =>
    labelFont.widthOfTextAtSize(c, fontSize),
  );
  return { fontSize, charWidths };
}

/**
 * Draws brand text along the top inner arc of a circular bleed frame (tangent to the ring).
 */
export function drawCurvedCircleBrandLabel(
  page: PDFPage,
  centerX: number,
  centerY: number,
  labelRadius: number,
  brandText: string,
  labelFont: PDFFont,
): void {
  const trimmed = brandText.trim();
  if (!trimmed || labelRadius <= 0) return;

  const { fontSize, charWidths } = fitCurvedBrandFontSize(
    labelFont,
    trimmed,
    labelRadius,
  );
  const placements = computeCurvedBrandPlacements(
    trimmed,
    charWidths,
    labelRadius,
  );

  for (let i = 0; i < placements.length; i++) {
    const { char, angleRad, rotateDeg } = placements[i]!;
    const cw = charWidths[i]!;
    const px = centerX + labelRadius * Math.cos(angleRad);
    const py = centerY + labelRadius * Math.sin(angleRad);
    const rotRad = (rotateDeg * Math.PI) / 180;

    /** Center glyph on arc point; baseline tangent to the ring. */
    const x = px - Math.cos(rotRad) * (cw / 2);
    const y = py - Math.sin(rotRad) * (cw / 2);

    page.drawText(char, {
      x,
      y,
      size: fontSize,
      font: labelFont,
      color: BRAND_COLOR,
      rotate: degrees(rotateDeg),
    });
  }
}

/** Radius (pt) for curved label — just inside the dashed bleed circle. */
export function circleBrandLabelRadius(frameDiameterPt: number): number {
  return frameDiameterPt / 2 - mm(2.5);
}
