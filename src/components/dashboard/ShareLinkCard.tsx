"use client";

import { useCallback, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export type ShareLinkCardProps = {
  label: string;
  publicUrl: string;
};

export function ShareLinkCard({ label, publicUrl }: ShareLinkCardProps) {
  const [copied, setCopied] = useState(false);
  const trimmed = publicUrl.trim();
  const hasUrl = trimmed.length > 0;

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

  return (
    <div className="rounded-lg border border-gray-200 bg-[#F9FAFB] px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
        {label}
      </p>
      {!hasUrl ? (
        <p className="mt-3 text-sm text-[#6B7280]">Share link unavailable</p>
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
          <div className="flex shrink-0 justify-center sm:justify-start">
            <div className="rounded-lg border border-gray-200 bg-white p-2">
              <QRCodeSVG
                value={trimmed}
                size={168}
                level="M"
                marginSize={2}
                title={`QR code for ${label}`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
