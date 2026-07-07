"use client";

import { useEffect } from "react";

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export type PrintOutcomeModalProps = {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function PrintOutcomeModal({
  open,
  saving,
  onClose,
  onConfirm,
}: PrintOutcomeModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, saving, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 dark:bg-black/70"
        aria-label="Close dialog"
        onClick={() => {
          if (!saving) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-outcome-title"
        className="relative w-full max-w-md overflow-hidden rounded-xl border-2 border-amber-400 bg-background shadow-2xl ring-2 ring-amber-400/30 dark:border-amber-500 dark:bg-card dark:ring-amber-500/40"
      >
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-4 sm:px-5 dark:border-amber-800 dark:bg-amber-950/50">
          <div className="flex gap-3 sm:gap-4">
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[#F59E0B] ring-2 ring-amber-300/80 dark:bg-amber-900/70 dark:text-amber-400 dark:ring-amber-600/60"
              aria-hidden
            >
              <AlertTriangleIcon className="size-6" />
            </div>
            <div className="min-w-0 pt-0.5">
              <h2
                id="print-outcome-title"
                className="text-base font-semibold text-amber-950 sm:text-lg dark:text-amber-100"
              >
                Did everything print correctly?
              </h2>
              <p className="mt-1 text-sm text-amber-900/90 dark:text-amber-200/90">
                Check the PDF that opened in a new tab, then confirm whether
                production printing finished successfully.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border bg-background px-4 py-3 dark:bg-card sm:flex-row sm:justify-end sm:px-5">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface disabled:opacity-50"
          >
            No → I&apos;ll reprint some later
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onConfirm}
            className="min-h-[44px] rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            {saving ? "Updating…" : "Yes → Mark all as printed"}
          </button>
        </div>
      </div>
    </div>
  );
}
