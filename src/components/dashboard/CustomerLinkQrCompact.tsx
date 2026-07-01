"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useCopyLink } from "@/hooks/useCopyLink";
import {
  QR_LEVEL,
  QR_MARGIN_MODULES,
  safeFileSlug,
  triggerDownload,
} from "@/lib/customerLinkQrExport";

const QR_PX_COMPACT = 132;

export type CustomerLinkQrCompactProps = {
  publicUrl: string;
  variant: "event" | "storefront";
  entityName: string;
  entityId: string;
  monthlyLimitReached?: boolean;
  className?: string;
};

export function CustomerLinkQrCompact({
  publicUrl,
  variant,
  entityName,
  entityId,
  monthlyLimitReached = false,
  className = "",
}: CustomerLinkQrCompactProps) {
  const [pngLoading, setPngLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { canCopy, trimmed } = useCopyLink(publicUrl);

  const qrTitle =
    variant === "event" ? "Event QR code" : "Storefront QR code";
  const prefix = variant === "event" ? "event" : "storefront";
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

  if (!canCopy) return null;

  return (
    <div
      className={`relative ${className}`}
      role="region"
      aria-label="Customer order QR code"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={
          monthlyLimitReached
            ? "pointer-events-none select-none blur-sm opacity-60"
            : undefined
        }
      >
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center">
          <div className="rounded-lg border border-green-200 bg-white p-2 dark:border-green-900 dark:bg-card">
            <QRCodeCanvas
              ref={canvasRef}
              value={trimmed}
              size={QR_PX_COMPACT}
              level={QR_LEVEL}
              marginSize={QR_MARGIN_MODULES}
              title={qrTitle}
            />
          </div>
          <button
            type="button"
            disabled={pngLoading || monthlyLimitReached}
            onClick={() => void downloadPng()}
            className="rounded-lg border border-green-200 bg-white px-4 py-2 text-sm font-medium text-green-900 transition-colors hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-green-900 dark:bg-card dark:text-green-100 dark:hover:bg-green-950/40"
          >
            {pngLoading ? "Preparing…" : "Download QR code"}
          </button>
        </div>
      </div>
      {monthlyLimitReached ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-green-50/70 px-4 py-6 text-center dark:bg-green-950/40">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-red-800 dark:text-red-400">
              Monthly usage has been reached
            </p>
            <p className="text-xs text-muted-foreground">
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
  );
}
