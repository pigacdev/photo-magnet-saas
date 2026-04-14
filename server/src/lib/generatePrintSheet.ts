import fs from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  rgb,
  StandardFonts,
  type PDFPage,
} from "pdf-lib";
import { getBrandTextForOrder } from "./brandTextForOrder";

export type PrintSheetImageInput = {
  id: string;
  renderedUrl: string | null;
};

const mm = (v: number) => v * 2.83465;

// A4
const PAGE_WIDTH = mm(210);
const PAGE_HEIGHT = mm(297);

/** Regular octagon: length of every edge (physical cutter / blade segment). */
const OCTAGON_SIDE_MM = 31;
/** Printed image — square, centered inside octagon bounds. */
const IMAGE_SIZE_MM = 52;

/** Spacing between rows (vertical); tune 6–10 mm if layout feels tight. */
const ROW_GAP_MM = 8;

const COLS = 2;
const ROWS = 3;
const slotsPerPage = COLS * ROWS;

const SQRT2 = Math.SQRT2;
/** Edge length in PDF points. */
const side = mm(OCTAGON_SIDE_MM);
/** Bounding square of the regular octagon (flat top/bottom). */
const octagonSize = side * (1 + SQRT2);
/** Corner inset along axes so each drawn segment length = `side`. */
const cut = side / SQRT2;

const imageSize = mm(IMAGE_SIZE_MM);
const rowGap = mm(ROW_GAP_MM);

const totalHeight = ROWS * octagonSize + (ROWS - 1) * rowGap;
const startY = (PAGE_HEIGHT - totalHeight) / 2;

/** Center of each column within the left/right half of the page. */
const halfWidth = PAGE_WIDTH / 2;
const colCenters = [halfWidth / 2, halfWidth + halfWidth / 2];

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
  const s = size;
  const c = cut;

  const points = [
    { x: x + c, y: y },
    { x: x + s - c, y: y },
    { x: x + s, y: y + c },
    { x: x + s, y: y + s - c },
    { x: x + s - c, y: y + s },
    { x: x + c, y: y + s },
    { x: x, y: y + s - c },
    { x: x, y: y + c },
  ];

  const stroke = rgb(0.6, 0.6, 0.6);
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i]!;
    const p2 = points[(i + 1) % points.length]!;
    page.drawLine({
      start: p1,
      end: p2,
      thickness: 1,
      color: stroke,
    });
  }
}

/**
 * A4 PDF: fixed 2×3 grid of **rendered** JPEGs. Regular octagon (30 mm edges); image centered inside.
 */
export async function generatePrintSheet(
  orderId: string,
  images: PrintSheetImageInput[],
  shapeId: string,
): Promise<string> {
  const onlyRendered = images.filter(
    (img): img is PrintSheetImageInput & { renderedUrl: string } =>
      Boolean(img.renderedUrl?.trim()),
  );

  const pdfDoc = await PDFDocument.create();

  if (onlyRendered.length === 0) {
    const emptyPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawVerticalCutLine(emptyPage);
  } else {
    const brandText = await getBrandTextForOrder(orderId);
    const labelFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    /** Future: load `Order.shortCode` for magnet bottom label (6-char). */
    const orderLabel: string | null = null; // future: shortCode
    let page!: PDFPage;
    let globalIndex = 0;

    for (const img of onlyRendered) {
      if (globalIndex % slotsPerPage === 0) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        drawVerticalCutLine(page);
      }

      const slotIndex = globalIndex % slotsPerPage;
      const col = slotIndex % COLS;
      const row = Math.floor(slotIndex / COLS);

      const centerX = colCenters[col]!;
      const x = centerX - octagonSize / 2;
      const y =
        PAGE_HEIGHT -
        startY -
        (row + 1) * octagonSize -
        row * rowGap;

      const filePath = resolveUploadFilePath(img.renderedUrl);
      const imageBytes = await fs.readFile(filePath);

      let pdfImage;
      if (filePath.toLowerCase().endsWith(".png")) {
        pdfImage = await pdfDoc.embedPng(imageBytes);
      } else {
        pdfImage = await pdfDoc.embedJpg(imageBytes);
      }

      drawOctagon(page, x, y, octagonSize);

      const offset = (octagonSize - imageSize) / 2;
      page.drawImage(pdfImage, {
        x: x + offset,
        y: y + offset,
        width: imageSize,
        height: imageSize,
      });

      /** Horizontal padding inside octagon so label never touches edges. */
      const maxLabelWidth = octagonSize - 10;
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

      const textX = x + (octagonSize - textWidth) / 2;
      const textY = y + octagonSize - 12;

      page.drawText(brandText, {
        x: textX,
        y: textY,
        size: fontSize,
        font: labelFont,
        color: rgb(0.45, 0.45, 0.45),
      });

      if (orderLabel) {
        const width = labelFont.widthOfTextAtSize(orderLabel, 6);
        const xPos = x + (octagonSize - width) / 2;

        page.drawText(orderLabel, {
          x: xPos,
          y: y + 4,
          size: 6,
          font: labelFont,
          color: rgb(0.5, 0.5, 0.5),
        });
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
