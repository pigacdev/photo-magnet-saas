"use client";

import { useEffect } from "react";

export type EventArchiveDownloadModalProps = {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function EventArchiveDownloadModal({
  open,
  loading,
  onClose,
  onConfirm,
}: EventArchiveDownloadModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        onClick={() => {
          if (!loading) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-archive-download-title"
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-background shadow-xl"
      >
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <h2
            id="event-archive-download-title"
            className="text-base font-semibold text-foreground sm:text-lg"
          >
            Download event archive
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This archive contains event order media currently still available.
            Media may be deleted after the scheduled cleanup time.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="min-h-[44px] rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1f2937] disabled:opacity-50"
          >
            {loading ? "Preparing download…" : "Download archive"}
          </button>
        </div>
      </div>
    </div>
  );
}
