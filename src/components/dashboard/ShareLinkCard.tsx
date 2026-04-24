"use client";

import { useCallback, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ShareLinkCardProps = {
  label: string;
  publicUrl: string;
  /** Used for download labels and filenames only. */
  variant: "event" | "storefront";
  entityName: string;
  entityId: string;
};

const QR_PX = 168;
const QR_LEVEL: "M" = "M";
/** Extra modules of quiet zone (in addition to encoded modules). */
const QR_MARGIN_MODULES = 4;

function safeFileSlug(name: string, id: string): string {
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

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
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

async function buildQrPdfPage(opts: {
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

export function ShareLinkCard({
  label,
  publicUrl,
  variant,
  entityName,
  entityId,
}: ShareLinkCardProps) {
  const [copied, setCopied] = useState(false);
  const [pngLoading, setPngLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const trimmed = publicUrl.trim();
  const hasUrl = trimmed.length > 0;
  const prefix = variant === "event" ? "event" : "storefront";
  const title =
    variant === "event" ? "Event QR code" : "Storefront QR code";
  const fileSlug = safeFileSlug(entityName, entityId);
  const baseName = `${prefix}-qr-${fileSlug}`;

  const copy = useCallback(async () => {
    if (!hasUrl) return;
    try {
      await navigator.clipboard.writeText(trimmed);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, [hasUrl, trimmed]);

  const downloadPng = useCallback(async () => {
    if (!hasUrl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setPngLoading(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      triggerDownload(dataUrl, `${baseName}.png`);
    } finally {
      setPngLoading(false);
    }
  }, [baseName, hasUrl]);

  const downloadPdf = useCallback(async () => {
    if (!hasUrl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setPdfError(null);
    setPdfLoading(true);
    try {
      const pngBytes = await canvasToPngBytes(canvas);
      const bytes = await buildQrPdfPage({
        pngBytes,
        title,
        entityName,
        publicUrl: trimmed,
      });
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const href = URL.createObjectURL(blob);
      try {
        triggerDownload(href, `${baseName}.pdf`);
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(href), 2_000);
      }
    } catch (e) {
      console.error("[ShareLinkCard] PDF export failed", e);
      setPdfError(
        "Could not create the PDF. You can use Download PNG instead.",
      );
    } finally {
      setPdfLoading(false);
    }
  }, [baseName, entityName, hasUrl, title, trimmed]);

  return (
    <div className="rounded-lg border border-gray-200 bg-[#F9FAFB] px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
        {label}
      </p>
      {!hasUrl ? (
        <p className="mt-3 text-sm text-[#6B7280]">QR unavailable</p>
      ) : (
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="break-all text-sm font-medium text-[#111111]">
              {trimmed}
            </p>
            <button
              type="button"
              onClick={() => void copy()}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-[#111111] transition-colors hover:bg-white/80"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
          <div className="flex w-full max-w-[12.5rem] shrink-0 flex-col items-stretch sm:max-w-[11rem]">
            <div className="mx-auto rounded-lg border border-gray-200 bg-white p-2">
              <QRCodeCanvas
                ref={canvasRef}
                value={trimmed}
                size={QR_PX}
                level={QR_LEVEL}
                marginSize={QR_MARGIN_MODULES}
                title={`QR code for ${label}`}
              />
            </div>
            <div className="mt-3 flex w-full flex-col gap-2">
              <button
                type="button"
                disabled={pngLoading}
                onClick={() => void downloadPng()}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-[#111111] transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pngLoading ? "Preparing…" : "Download PNG"}
              </button>
              <button
                type="button"
                disabled={pdfLoading}
                onClick={() => {
                  void downloadPdf();
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-[#111111] transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pdfLoading ? "Preparing…" : "Download PDF"}
              </button>
              {pdfError ? (
                <p className="text-center text-xs leading-snug text-red-600" role="alert">
                  {pdfError}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
