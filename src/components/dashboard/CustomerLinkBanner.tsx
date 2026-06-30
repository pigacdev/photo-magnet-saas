"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useCopyLink } from "@/hooks/useCopyLink";
import {
  QR_LEVEL,
  QR_MARGIN_MODULES,
  QR_PX,
  buildQrPdfPage,
  canvasToPngBytes,
  safeFileSlug,
  triggerDownload,
} from "@/lib/customerLinkQrExport";

export type CustomerLinkBannerProps = {
  publicUrl: string;
  variant: "event" | "storefront";
  entityName: string;
  entityId: string;
  monthlyLimitReached?: boolean;
  className?: string;
};

export function CustomerLinkBanner({
  publicUrl,
  variant,
  entityName,
  entityId,
  monthlyLimitReached = false,
  className = "mt-4",
}: CustomerLinkBannerProps) {
  const [pngLoading, setPngLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { copy, copied, canCopy, trimmed } = useCopyLink(publicUrl);

  const ariaLabel =
    variant === "event"
      ? "Copy customer event order link"
      : "Copy customer storefront order link";

  const prefix = variant === "event" ? "event" : "storefront";
  const qrTitle =
    variant === "event" ? "Event QR code" : "Storefront QR code";
  const fileSlug = safeFileSlug(entityName, entityId);
  const baseName = `${prefix}-qr-${fileSlug}`;

  const downloadPng = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setPngLoading(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      triggerDownload(dataUrl, `${baseName}.png`);
    } finally {
      setPngLoading(false);
    }
  }, [baseName]);

  const downloadPdf = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setPdfError(null);
    setPdfLoading(true);
    try {
      const pngBytes = await canvasToPngBytes(canvas);
      const bytes = await buildQrPdfPage({
        pngBytes,
        title: qrTitle,
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
      console.error("[CustomerLinkBanner] PDF export failed", e);
      setPdfError(
        "Could not create the PDF. You can use Download PNG instead.",
      );
    } finally {
      setPdfLoading(false);
    }
  }, [baseName, entityName, qrTitle, trimmed]);

  if (!canCopy) return null;

  return (
    <div
      className={`w-full max-w-full rounded-xl border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-950/20 ${className}`}
      role="region"
      aria-label="Customer order link"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div>
          <p className="text-sm font-semibold text-green-800 dark:text-green-300">
            Customer order link
          </p>
          <p className="mt-0.5 text-sm text-green-800/90 dark:text-green-300/90">
            Share this link or QR code with customers.
          </p>
        </div>
        {monthlyLimitReached ? (
          <div className="shrink-0 space-y-1 text-sm">
            <p className="font-semibold text-red-800 dark:text-red-400">
              Monthly usage has been reached
            </p>
            <Link
              href="/dashboard/billing"
              className="font-medium text-primary underline"
            >
              View plans
            </Link>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void copy()}
            aria-label={ariaLabel}
            className="shrink-0 min-h-[44px] rounded-lg bg-[#16A34A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        )}
      </div>

      <div className="relative mt-4 border-t border-green-200 pt-4 dark:border-green-900">
        <div
          className={
            monthlyLimitReached
              ? "pointer-events-none select-none blur-sm opacity-60"
              : undefined
          }
        >
          <div className="flex flex-col items-center">
            <p className="text-center text-xs text-green-800/80 dark:text-green-300/80">
              Scan or download a QR code for print materials.
            </p>
            <div className="mt-4 rounded-lg border border-green-200 bg-white p-2 dark:border-green-900 dark:bg-card">
              <QRCodeCanvas
                ref={canvasRef}
                value={trimmed}
                size={QR_PX}
                level={QR_LEVEL}
                marginSize={QR_MARGIN_MODULES}
                title={qrTitle}
              />
            </div>
            <div className="mt-4 grid w-full max-w-[17.5rem] grid-cols-2 gap-2">
              <button
                type="button"
                disabled={pngLoading || monthlyLimitReached}
                onClick={() => void downloadPng()}
                className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm font-medium text-green-900 transition-colors hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-green-900 dark:bg-card dark:text-green-100 dark:hover:bg-green-950/40"
              >
                {pngLoading ? "Preparing…" : "Download PNG"}
              </button>
              <button
                type="button"
                disabled={pdfLoading || monthlyLimitReached}
                onClick={() => {
                  void downloadPdf();
                }}
                className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm font-medium text-green-900 transition-colors hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-green-900 dark:bg-card dark:text-green-100 dark:hover:bg-green-950/40"
              >
                {pdfLoading ? "Preparing…" : "Download PDF"}
              </button>
            </div>
            {pdfError ? (
              <p
                className="mt-2 text-center text-xs leading-snug text-red-600"
                role="alert"
              >
                {pdfError}
              </p>
            ) : null}
          </div>
        </div>
        {monthlyLimitReached ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-green-50/70 px-4 py-6 text-center dark:bg-green-950/40">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-red-800 dark:text-red-400">
                Monthly usage has been reached
              </p>
              <p className="text-xs text-green-800/80 dark:text-green-300/80">
                Customer ordering is paused until you upgrade or your usage
                resets.
              </p>
              <Link
                href="/dashboard/billing"
                className="inline-block text-sm font-medium text-primary underline"
              >
                View plans
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
