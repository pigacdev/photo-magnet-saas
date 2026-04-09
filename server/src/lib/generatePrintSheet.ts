import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";

export type PrintSheetImageInput = {
  id: string;
  renderedUrl: string | null;
};

const mm = (v: number) => v * 2.83465;

/** Local file path from a same-origin `/uploads/...` URL. */
function resolveUploadFilePath(publicUrl: string): string {
  const rel = publicUrl.replace(/^\/+/, "");
  return path.join(process.cwd(), rel);
}

/**
 * A4 PDF: 2×3 grid of **rendered** JPEGs only (`renderedUrl`). No stretch — square magnets
 * centered in cells with cutting margin. Pagination every 6 images.
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

  const cols = 2;
  const rows = 3;

  const magnetSize = mm(50);
  const cellSize = mm(65);
  const gap = mm(10);

  const gridWidth = cols * cellSize + (cols - 1) * gap;
  const gridHeight = rows * cellSize + (rows - 1) * gap;

  const startX = (pageWidth - gridWidth) / 2;
  const startY = (pageHeight - gridHeight) / 2;

  const slotsPerPage = cols * rows;
  const imageSize = magnetSize;

  if (onlyRendered.length === 0) {
    pdfDoc.addPage([pageWidth, pageHeight]);
  } else {
    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let slotOnPage = 0;

    for (const img of onlyRendered) {
      if (slotOnPage >= slotsPerPage) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        slotOnPage = 0;
      }

      const index = slotOnPage;
      const col = index % cols;
      const row = Math.floor(index / cols);

      const x = startX + col * (cellSize + gap);
      const y =
        pageHeight -
        startY -
        (row + 1) * cellSize -
        row * gap;

      const offsetX = (cellSize - imageSize) / 2;
      const offsetY = (cellSize - imageSize) / 2;

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
        width: cellSize,
        height: cellSize,
        borderWidth: 0.75,
        borderColor: rgb(0.7, 0.7, 0.7),
      });

      page.drawImage(pdfImage, {
        x: x + offsetX,
        y: y + offsetY,
        width: imageSize,
        height: imageSize,
      });

      slotOnPage += 1;
    }
  }

  const outputDir = path.join(process.cwd(), "uploads", "print-sheets");
  await fs.mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${orderId}.pdf`);
  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(outputPath, pdfBytes);

  return `/uploads/print-sheets/${orderId}.pdf`;
}
