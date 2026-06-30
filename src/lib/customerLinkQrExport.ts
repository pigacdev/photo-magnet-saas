import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const QR_PX = 168;
export const QR_LEVEL: "M" = "M";
/** Extra modules of quiet zone (in addition to encoded modules). */
export const QR_MARGIN_MODULES = 4;

export function safeFileSlug(name: string, id: string): string {
  const fromName = name
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  if (fromName.length > 0) return fromName;
  return id
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
}

export function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not read QR image"));
          return;
        }
        void blob.arrayBuffer().then((ab) => {
          resolve(new Uint8Array(ab));
        });
      },
      "image/png",
      1,
    );
  });
}

function wrapUrlLines(url: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (let i = 0; i < url.length; i += maxChars) {
    lines.push(url.slice(i, i + maxChars));
  }
  return lines.length > 0 ? lines : [url];
}

/**
 * Standard 14 fonts in pdf-lib use WinAnsi; characters like ć must not reach drawText.
 * Does not affect QR data or the live public URL in the app — only PDF typography.
 */
function pdfTextToWinAnsiSafe(input: string): string {
  const explicit: Record<string, string> = {
    ć: "c",
    č: "c",
    Ć: "C",
    Č: "C",
    ž: "z",
    Ž: "Z",
    š: "s",
    Š: "S",
    đ: "d",
    Đ: "D",
  };
  let s = "";
  for (const ch of input) {
    s += explicit[ch] ?? ch;
  }
  s = s.normalize("NFD").replace(/[\u0300-\u036F]/g, "");
  s = s.replace(/[^\t\n\r\x20-\x7E]/g, "");
  return s;
}

export async function buildQrPdfPage(opts: {
  pngBytes: Uint8Array;
  title: string;
  entityName: string;
  publicUrl: string;
}): Promise<Uint8Array> {
  const titlePdf = pdfTextToWinAnsiSafe(opts.title);
  const namePdf = pdfTextToWinAnsiSafe(opts.entityName);
  const urlPdf = pdfTextToWinAnsiSafe(opts.publicUrl);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const png = await pdfDoc.embedPng(opts.pngBytes);

  const titleSize = 18;
  const nameSize = 11;
  const urlSize = 9;
  const marginX = 40;

  const titleW = fontBold.widthOfTextAtSize(titlePdf, titleSize);
  /** Next text baseline from bottom, moving downward (decreasing y) after each block. */
  let baselineY = height - 52;
  page.drawText(titlePdf, {
    x: (width - titleW) / 2,
    y: baselineY,
    size: titleSize,
    font: fontBold,
    color: rgb(0.08, 0.08, 0.1),
  });
  baselineY -= 28;

  const trimmedName = namePdf.trim();
  if (trimmedName) {
    const nw = font.widthOfTextAtSize(trimmedName, nameSize);
    const maxNameW = width - 2 * marginX;
    const nameLines =
      nw <= maxNameW
        ? [trimmedName]
        : wrapUrlLines(trimmedName, 56);
    for (const line of nameLines) {
      const lw = font.widthOfTextAtSize(line, nameSize);
      page.drawText(line, {
        x: (width - lw) / 2,
        y: baselineY,
        size: nameSize,
        font,
        color: rgb(0.25, 0.25, 0.28),
      });
      baselineY -= nameSize + 4;
    }
    baselineY -= 8;
  } else {
    baselineY -= 6;
  }

  const maxQrW = 280;
  const scale = maxQrW / png.width;
  const drawW = png.width * scale;
  const drawH = png.height * scale;
  const imgX = (width - drawW) / 2;
  const gapBeforeQr = 10;
  /** Top of QR ≈ `baselineY`; `drawImage` uses bottom edge y. */
  const imgBottom = baselineY - gapBeforeQr - drawH;
  const safeBottom = 100;
  const imgBottomClamped = Math.max(safeBottom, imgBottom);
  page.drawImage(png, {
    x: imgX,
    y: imgBottomClamped,
    width: drawW,
    height: drawH,
  });

  const urlLines = wrapUrlLines(urlPdf, 78);
  let urlY = imgBottomClamped - 14;
  for (const line of urlLines) {
    if (urlY < 36) break;
    const lw = font.widthOfTextAtSize(line, urlSize);
    page.drawText(line, {
      x: (width - lw) / 2,
      y: urlY,
      size: urlSize,
      font,
      color: rgb(0.2, 0.2, 0.25),
    });
    urlY -= urlSize + 3;
  }

  return pdfDoc.save();
}
