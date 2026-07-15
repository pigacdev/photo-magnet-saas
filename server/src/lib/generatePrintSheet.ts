import fs from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  appendBezierCurve,
  clipEvenOdd,
  endPath,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  StandardFonts,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { getBrandTextForOrder } from "./brandTextForOrder";
import {
  circleBrandLabelRadius,
  drawCurvedCircleBrandLabel,
} from "./printSheetCircleBrand";
import {
  computePrintGrid,
  isLegacySquare50Layout,
  mm,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  printImageSizeMm,
  printFrameSizeMm,
  rowGap,
  slotOrigin,
  type PrintSheetShape,
} from "./printSheetLayout";
import { isProductionValidatedShape } from "./validatedShapes";

export type { PrintSheetShape } from "./printSheetLayout";

export type PrintSheetImageInput = {
  id: string;
  renderedUrl: string | null;
};

/**
 * Expands each order line by `copies` so the PDF contains one slot per physical magnet.
 */
export function expandOrderImagesForPrintSheet(
  images: Array<{ id: string; renderedUrl: string | null; copies: number }>,
): PrintSheetImageInput[] {
  const out: PrintSheetImageInput[] = [];
  for (const img of images) {
    const n = Math.max(1, Math.floor(Number(img.copies)) || 1);
    for (let k = 0; k < n; k++) {
      out.push({ id: img.id, renderedUrl: img.renderedUrl });
    }
  }
  return out;
}

/** Regular octagon: length of every edge (physical cutter / blade segment). */
const OCTAGON_SIDE_MM = 31;
/** Printed image — square, centered inside octagon bounds. */
const IMAGE_SIZE_MM = 52;

const COLS = 2;
const ROWS = 3;
const legacySlotsPerPage = COLS * ROWS;

const SQRT2 = Math.SQRT2;
/** Edge length in PDF points. */
const side = mm(OCTAGON_SIDE_MM);
/** Bounding square of the regular octagon (flat top/bottom). */
const octagonSize = side * (1 + SQRT2);
/** Corner inset along axes so each drawn segment length = `side`. */
const cut = side / SQRT2;

const legacyImageSize = mm(IMAGE_SIZE_MM);

const legacyTotalHeight = ROWS * octagonSize + (ROWS - 1) * rowGap;
const legacyStartY = (PAGE_HEIGHT - legacyTotalHeight) / 2;

/** Center of each column within the left/right half of the page. */
const halfWidth = PAGE_WIDTH / 2;
const legacyColCenters = [halfWidth / 2, halfWidth + halfWidth / 2];

const CUT_STROKE = rgb(0.6, 0.6, 0.6);
const KAPPA = (4.0 * (Math.sqrt(2) - 1.0)) / 3.0;

/** Local file path from a same-origin `/uploads/...` URL. */
function resolveUploadFilePath(publicUrl: string): string {
  const rel = publicUrl.replace(/^\/+/, "");
  return path.join(process.cwd(), rel);
}

/** Vertical center line — fold/cut guide between the two columns (subtle, dashed). */
function drawVerticalCutLine(page: PDFPage): void {
  const edgeMargin = mm(5);
  page.drawLine({
    start: { x: PAGE_WIDTH / 2, y: edgeMargin },
    end: { x: PAGE_WIDTH / 2, y: PAGE_HEIGHT - edgeMargin },
    thickness: 1,
    color: rgb(0.75, 0.75, 0.75),
    dashArray: [4, 4],
  });
}

/**
 * Regular octagon (all 8 edges equal length `side` in points). `size` must be `octagonSize`.
 */
function drawOctagon(
  page: PDFPage,
  x: number,
  y: number,
  size: number,
): void {
  drawOctagonFrame(page, x, y, size, size);
}

/**
 * Chamfered-rectangle octagon cut guide around a W×H bounding box (same corner geometry as legacy square).
 */
function drawOctagonFrame(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const w = width;
  const h = height;
  const c = cut;

  const points = [
    { x: x + c, y: y },
    { x: x + w - c, y: y },
    { x: x + w, y: y + c },
    { x: x + w, y: y + h - c },
    { x: x + w - c, y: y + h },
    { x: x + c, y: y + h },
    { x: x, y: y + h - c },
    { x: x, y: y + c },
  ];

  for (let i = 0; i < points.length; i++) {
    const p1 = points[i]!;
    const p2 = points[(i + 1) % points.length]!;
    page.drawLine({
      start: p1,
      end: p2,
      thickness: 1,
      color: CUT_STROKE,
    });
  }
}

function drawBrandLabel(
  page: PDFPage,
  x: number,
  y: number,
  slotW: number,
  slotH: number,
  brandText: string,
  labelFont: PDFFont,
): void {
  const maxLabelWidth = slotW - 10;
  let fontSize = 8;
  let textWidth = labelFont.widthOfTextAtSize(brandText, fontSize);
  if (textWidth > maxLabelWidth) {
    fontSize = 6;
    textWidth = labelFont.widthOfTextAtSize(brandText, fontSize);
  }
  if (textWidth > maxLabelWidth) {
    fontSize = Math.max(2, fontSize * (maxLabelWidth / textWidth));
    textWidth = labelFont.widthOfTextAtSize(brandText, fontSize);
  }

  const textX = x + (slotW - textWidth) / 2;
  const textY = y + slotH - 12;

  page.drawText(brandText, {
    x: textX,
    y: textY,
    size: fontSize,
    font: labelFont,
    color: rgb(0.45, 0.45, 0.45),
  });
}

function drawOrderLabel(
  page: PDFPage,
  x: number,
  y: number,
  slotW: number,
  orderLabel: string,
  labelFont: PDFFont,
): void {
  const width = labelFont.widthOfTextAtSize(orderLabel, 6);
  const xPos = x + (slotW - width) / 2;

  page.drawText(orderLabel, {
    x: xPos,
    y: y + 4,
    size: 6,
    font: labelFont,
    color: rgb(0.5, 0.5, 0.5),
  });
}

async function embedRenderedImage(
  pdfDoc: PDFDocument,
  renderedUrl: string,
): Promise<PDFImage> {
  const filePath = resolveUploadFilePath(renderedUrl);
  const imageBytes = await fs.readFile(filePath);
  if (filePath.toLowerCase().endsWith(".png")) {
    return pdfDoc.embedPng(imageBytes);
  }
  return pdfDoc.embedJpg(imageBytes);
}

/** Ellipse path operators for vector clipping (center coords, equal radii). */
function circleClipOperators(cx: number, cy: number, radius: number) {
  const x = cx - radius;
  const y = cy - radius;
  const xScale = radius;
  const yScale = radius;
  const ox = xScale * KAPPA;
  const oy = yScale * KAPPA;
  const xe = x + xScale * 2;
  const ye = y + yScale * 2;
  const xm = x + xScale;
  const ym = y + yScale;

  return [
    moveTo(x, ym),
    appendBezierCurve(x, ym - oy, xm - ox, y, xm, y),
    appendBezierCurve(xm + ox, y, xe, ym - oy, xe, ym),
    appendBezierCurve(xe, ym + oy, xm + ox, ye, xm, ye),
    appendBezierCurve(xm - ox, ye, x, ym + oy, x, ym),
  ];
}

function drawCircleBleedGuide(
  page: PDFPage,
  x: number,
  y: number,
  frameDiameter: number,
): void {
  const radius = frameDiameter / 2;
  page.drawCircle({
    x: x + radius,
    y: y + radius,
    size: radius,
    borderColor: CUT_STROKE,
    borderWidth: 1,
    borderDashArray: [4, 4],
  });
}

function drawClippedCircleImage(
  page: PDFPage,
  pdfImage: PDFImage,
  x: number,
  y: number,
  size: number,
): void {
  const radius = size / 2;
  const cx = x + radius;
  const cy = y + radius;

  page.pushOperators(
    pushGraphicsState(),
    ...circleClipOperators(cx, cy, radius),
    clipEvenOdd(),
    endPath(),
  );
  page.drawImage(pdfImage, { x, y, width: size, height: size });
  page.pushOperators(popGraphicsState());
}

/** Square 50×50 mm — octagon cutter template (unchanged legacy layout). */
async function drawLegacySquare50Slot(
  page: PDFPage,
  pdfDoc: PDFDocument,
  img: PrintSheetImageInput & { renderedUrl: string },
  slotIndex: number,
  brandText: string,
  labelFont: PDFFont,
  orderLabel: string | null,
): Promise<void> {
  const col = slotIndex % COLS;
  const row = Math.floor(slotIndex / COLS);

  const centerX = legacyColCenters[col]!;
  const x = centerX - octagonSize / 2;
  const y =
    PAGE_HEIGHT - legacyStartY - (row + 1) * octagonSize - row * rowGap;

  const pdfImage = await embedRenderedImage(pdfDoc, img.renderedUrl);

  drawOctagon(page, x, y, octagonSize);

  const offset = (octagonSize - legacyImageSize) / 2;
  page.drawImage(pdfImage, {
    x: x + offset,
    y: y + offset,
    width: legacyImageSize,
    height: legacyImageSize,
  });

  drawBrandLabel(page, x, y, octagonSize, octagonSize, brandText, labelFont);

  if (orderLabel) {
    drawOrderLabel(page, x, y, octagonSize, orderLabel, labelFont);
  }
}

async function drawShapeAwareSlot(
  page: PDFPage,
  pdfDoc: PDFDocument,
  shape: PrintSheetShape,
  img: PrintSheetImageInput & { renderedUrl: string },
  slotIndex: number,
  brandText: string,
  labelFont: PDFFont,
  orderLabel: string | null,
): Promise<void> {
  const printSize = printImageSizeMm(shape);
  const frameSize = printFrameSizeMm(shape);
  const grid = computePrintGrid(frameSize.w, frameSize.h);
  const { x, y } = slotOrigin(grid, slotIndex);
  const frameW = mm(frameSize.w);
  const frameH = mm(frameSize.h);
  const imageW = mm(printSize.w);
  const imageH = mm(printSize.h);
  const imageX = x + (frameW - imageW) / 2;
  const imageY = y + (frameH - imageH) / 2;

  const pdfImage = await embedRenderedImage(pdfDoc, img.renderedUrl);

  if (shape.shapeType === "CIRCLE") {
    drawCircleBleedGuide(page, x, y, frameW);
    drawClippedCircleImage(page, pdfImage, imageX, imageY, imageW);
    const frameCx = x + frameW / 2;
    const frameCy = y + frameH / 2;
    drawCurvedCircleBrandLabel(
      page,
      frameCx,
      frameCy,
      circleBrandLabelRadius(frameW),
      brandText,
      labelFont,
    );
  } else {
    drawOctagonFrame(page, x, y, frameW, frameH);
    page.drawImage(pdfImage, {
      x: imageX,
      y: imageY,
      width: imageW,
      height: imageH,
    });
    drawBrandLabel(page, x, y, frameW, frameH, brandText, labelFont);
  }

  if (orderLabel) {
    drawOrderLabel(page, x, y, frameW, orderLabel, labelFont);
  }
}

/**
 * A4 PDF: rendered JPEGs laid out per magnet shape (cut guides + correct dimensions).
 */
export async function generatePrintSheet(
  orderId: string,
  images: PrintSheetImageInput[],
  shapeId: string,
  shape: PrintSheetShape,
): Promise<string> {
  if (!isProductionValidatedShape(shape)) {
    throw new Error(
      `Refusing to generate print sheet for unvalidated shape ${shape.shapeType} ${shape.widthMm}x${shape.heightMm} mm`,
    );
  }

  const onlyRendered = images.filter(
    (img): img is PrintSheetImageInput & { renderedUrl: string } =>
      Boolean(img.renderedUrl?.trim()),
  );

  const pdfDoc = await PDFDocument.create();
  const legacy = isLegacySquare50Layout(shape);
  const frameSize = printFrameSizeMm(shape);
  const shapeAwareGrid = legacy
    ? null
    : computePrintGrid(frameSize.w, frameSize.h);
  const slotsPerPage = legacy
    ? legacySlotsPerPage
    : shapeAwareGrid!.slotsPerPage;

  if (onlyRendered.length === 0) {
    const emptyPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawVerticalCutLine(emptyPage);
  } else {
    const brandText = await getBrandTextForOrder(orderId);
    const labelFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    /** Future: load `Order.shortCode` for magnet bottom label (6-char). */
    const orderLabel: string | null = null;
    let page!: PDFPage;
    let globalIndex = 0;

    for (const img of onlyRendered) {
      if (globalIndex % slotsPerPage === 0) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        drawVerticalCutLine(page);
      }

      const slotIndex = globalIndex % slotsPerPage;

      if (legacy) {
        await drawLegacySquare50Slot(
          page,
          pdfDoc,
          img,
          slotIndex,
          brandText,
          labelFont,
          orderLabel,
        );
      } else {
        await drawShapeAwareSlot(
          page,
          pdfDoc,
          shape,
          img,
          slotIndex,
          brandText,
          labelFont,
          orderLabel,
        );
      }

      globalIndex += 1;
    }
  }

  const outputDir = path.join(process.cwd(), "uploads", "print-sheets");
  await fs.mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${orderId}-${shapeId}.pdf`);
  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(outputPath, pdfBytes);

  return `/uploads/print-sheets/${orderId}-${shapeId}.pdf`;
}
