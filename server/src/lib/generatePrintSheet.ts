import fs from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  rgb,
  StandardFonts,
  type PDFPage,
} from "pdf-lib";
import { prisma } from "./prisma";

export type PrintSheetImageInput = {
  id: string;
  renderedUrl: string | null;
};

const mm = (v: number) => v * 2.83465;

const DEFAULT_MAGNET_MM = { widthMm: 50, heightMm: 50 };

/** Magnet size from AllowedShape (one PDF batch = one shape). */
async function loadMagnetMmFromShape(
  shapeId: string,
): Promise<{ widthMm: number; heightMm: number }> {
  const shape = await prisma.allowedShape.findUnique({
    where: { id: shapeId },
  });
  if (!shape) {
    return { ...DEFAULT_MAGNET_MM };
  }
  return { widthMm: shape.widthMm, heightMm: shape.heightMm };
}

/** Local file path from a same-origin `/uploads/...` URL. */
function resolveUploadFilePath(publicUrl: string): string {
  const rel = publicUrl.replace(/^\/+/, "");
  return path.join(process.cwd(), rel);
}

/** Stroked octagonal cut guide (corner cuts); matches square `size * 0.2` when width === height. */
function drawOctagon(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const cut = Math.min(width, height) * 0.2;
  const c = Math.min(cut, width / 2, height / 2);

  const points: [number, number][] = [
    [x + c, y],
    [x + width - c, y],
    [x + width, y + c],
    [x + width, y + height - c],
    [x + width - c, y + height],
    [x + c, y + height],
    [x, y + height - c],
    [x, y + c],
  ];

  const stroke = rgb(0.5, 0.5, 0.5);
  for (let i = 0; i < 8; i++) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[(i + 1) % 8]!;
    page.drawLine({
      start: { x: x0, y: y0 },
      end: { x: x1, y: y1 },
      thickness: 1.2,
      color: stroke,
      dashArray: [4, 3],
    });
  }
}

/**
 * A4 PDF: grid of **rendered** JPEGs only (`renderedUrl`). No stretch — magnets
 * sized from AllowedShape, centered in cells with cutting margin. Multi-page by slots per page.
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

  const pageWidth = mm(210);
  const pageHeight = mm(297);

  /** Symmetric page margin — room for alignment and trimming. */
  const pageMarginMm = 12;
  const pageMarginPt = mm(pageMarginMm);
  const usableWidth = pageWidth - 2 * pageMarginPt;
  const usableHeight = pageHeight - 2 * pageMarginPt;

  const gap = mm(8);
  const padding = mm(10);

  if (onlyRendered.length === 0) {
    pdfDoc.addPage([pageWidth, pageHeight]);
  } else {
    const { widthMm, heightMm } = await loadMagnetMmFromShape(shapeId);

    const magnetWidth = mm(widthMm);
    const magnetHeight = mm(heightMm);

    /** Square cell: octagon cut guide matches the cell; image centered in cell (not separate rectangular cell vs square octagon). */
    const innerW = magnetWidth + padding * 2;
    const innerH = magnetHeight + padding * 2;
    const cellSize = Math.max(innerW, innerH);

    const cols = Math.max(
      1,
      Math.floor((usableWidth + gap) / (cellSize + gap)),
    );
    const rows = Math.max(
      1,
      Math.floor((usableHeight + gap) / (cellSize + gap)),
    );

    const gridWidth = cols * cellSize + (cols - 1) * gap;
    const gridHeight = rows * cellSize + (rows - 1) * gap;

    const startX = (pageWidth - gridWidth) / 2;
    const startY = (pageHeight - gridHeight) / 2;

    const slotsPerPage = cols * rows;

    const labelFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let page!: PDFPage;
    let globalIndex = 0;

    for (const img of onlyRendered) {
      if (globalIndex % slotsPerPage === 0) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
      }

      const slotIndex = globalIndex % slotsPerPage;
      const col = slotIndex % cols;
      const row = Math.floor(slotIndex / cols);

      const x = startX + col * (cellSize + gap);
      const y =
        pageHeight -
        startY -
        (row + 1) * cellSize -
        row * gap;

      const offsetX = (cellSize - magnetWidth) / 2;
      const offsetY = (cellSize - magnetHeight) / 2;

      const filePath = resolveUploadFilePath(img.renderedUrl);
      const imageBytes = await fs.readFile(filePath);

      let pdfImage;
      if (filePath.toLowerCase().endsWith(".png")) {
        pdfImage = await pdfDoc.embedPng(imageBytes);
      } else {
        pdfImage = await pdfDoc.embedJpg(imageBytes);
      }

      drawOctagon(page, x, y, cellSize, cellSize);

      page.drawImage(pdfImage, {
        x: x + offsetX,
        y: y + offsetY,
        width: magnetWidth,
        height: magnetHeight,
      });

      page.drawText("magnetoo", {
        x: x + cellSize / 2 - 20,
        y: y + cellSize - 10,
        size: 6,
        font: labelFont,
        color: rgb(0.45, 0.45, 0.45),
      });

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
