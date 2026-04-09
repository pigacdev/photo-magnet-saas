import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFPage } from "pdf-lib";
import { prisma } from "./prisma";

export type PrintSheetImageInput = {
  id: string;
  renderedUrl: string | null;
};

const mm = (v: number) => v * 2.83465;

const DEFAULT_MAGNET_MM = { widthMm: 50, heightMm: 50 };

/** Resolve magnet size from order → committed session → AllowedShape (widthMm / heightMm). */
async function loadMagnetMmForOrder(
  orderId: string,
): Promise<{ widthMm: number; heightMm: number }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      committedFromSession: { select: { selectedShapeId: true } },
    },
  });
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }
  const shapeId = order.committedFromSession?.selectedShapeId;
  if (!shapeId) {
    return { ...DEFAULT_MAGNET_MM };
  }
  const shape = await prisma.allowedShape.findFirst({
    where: {
      id: shapeId,
      contextType: order.contextType,
      contextId: order.contextId,
    },
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

/**
 * A4 PDF: grid of **rendered** JPEGs only (`renderedUrl`). No stretch — magnets
 * sized from AllowedShape, centered in cells with cutting margin. Multi-page by slots per page.
 */
export async function generatePrintSheet(
  orderId: string,
  images: PrintSheetImageInput[],
): Promise<string> {
  const onlyRendered = images.filter(
    (img): img is PrintSheetImageInput & { renderedUrl: string } =>
      Boolean(img.renderedUrl?.trim()),
  );

  const pdfDoc = await PDFDocument.create();

  const pageWidth = mm(210);
  const pageHeight = mm(297);

  const pageMargin = mm(20);
  const usableWidth = pageWidth - pageMargin;
  const usableHeight = pageHeight - pageMargin;

  const gap = mm(5);
  const padding = mm(7);

  if (onlyRendered.length === 0) {
    pdfDoc.addPage([pageWidth, pageHeight]);
  } else {
    const { widthMm, heightMm } = await loadMagnetMmForOrder(orderId);

    const magnetWidth = mm(widthMm);
    const magnetHeight = mm(heightMm);

    const cellWidth = magnetWidth + padding * 2;
    const cellHeight = magnetHeight + padding * 2;

    const cols = Math.max(
      1,
      Math.floor((usableWidth + gap) / (cellWidth + gap)),
    );
    const rows = Math.max(
      1,
      Math.floor((usableHeight + gap) / (cellHeight + gap)),
    );

    const gridWidth = cols * cellWidth + (cols - 1) * gap;
    const gridHeight = rows * cellHeight + (rows - 1) * gap;

    const startX = (pageWidth - gridWidth) / 2;
    const startY = (pageHeight - gridHeight) / 2;

    const slotsPerPage = cols * rows;

    let page!: PDFPage;
    let globalIndex = 0;

    for (const img of onlyRendered) {
      if (globalIndex % slotsPerPage === 0) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
      }

      const slotIndex = globalIndex % slotsPerPage;
      const col = slotIndex % cols;
      const row = Math.floor(slotIndex / cols);

      const x = startX + col * (cellWidth + gap);
      const y =
        pageHeight -
        startY -
        (row + 1) * cellHeight -
        row * gap;

      const offsetX = (cellWidth - magnetWidth) / 2;
      const offsetY = (cellHeight - magnetHeight) / 2;

      const filePath = resolveUploadFilePath(img.renderedUrl);
      const imageBytes = await fs.readFile(filePath);

      let pdfImage;
      if (filePath.toLowerCase().endsWith(".png")) {
        pdfImage = await pdfDoc.embedPng(imageBytes);
      } else {
        pdfImage = await pdfDoc.embedJpg(imageBytes);
      }

      page.drawRectangle({
        x,
        y,
        width: cellWidth,
        height: cellHeight,
        borderWidth: 0.75,
        borderColor: rgb(0.7, 0.7, 0.7),
      });

      page.drawImage(pdfImage, {
        x: x + offsetX,
        y: y + offsetY,
        width: magnetWidth,
        height: magnetHeight,
      });

      globalIndex += 1;
    }
  }

  const outputDir = path.join(process.cwd(), "uploads", "print-sheets");
  await fs.mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${orderId}.pdf`);
  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(outputPath, pdfBytes);

  return `/uploads/print-sheets/${orderId}.pdf`;
}
