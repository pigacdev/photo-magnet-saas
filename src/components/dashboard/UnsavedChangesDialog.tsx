"use client";

import { useEffect, useRef } from "react";

export type UnsavedChangesDialogProps = {
  open: boolean;
  message: string;
  onStay: () => void;
  onLeave: () => void;
};

export function UnsavedChangesDialog({
  open,
  message,
  onStay,
  onLeave,
}: UnsavedChangesDialogProps) {
  const stayButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onStay();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    stayButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onStay]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        onClick={onStay}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-background shadow-xl"
      >
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <h2
            id="unsaved-changes-title"
            className="text-base font-semibold text-foreground sm:text-lg"
          >
            Unsaved changes
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
          <button
            ref={stayButtonRef}
            type="button"
            onClick={onStay}
            className="min-h-[44px] rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface"
          >
            Stay on page
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="min-h-[44px] rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
          >
            Leave without saving
          </button>
        </div>
      </div>
    </div>
  );
}
