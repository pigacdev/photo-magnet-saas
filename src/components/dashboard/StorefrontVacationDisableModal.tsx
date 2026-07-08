"use client";

import { useEffect } from "react";

export type StorefrontVacationDisableModalProps = {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function StorefrontVacationDisableModal({
  open,
  loading,
  onClose,
  onConfirm,
}: StorefrontVacationDisableModalProps) {
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
        aria-labelledby="storefront-vacation-disable-title"
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-background shadow-xl"
      >
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <h2
            id="storefront-vacation-disable-title"
            className="text-base font-semibold text-foreground sm:text-lg"
          >
            Disable vacation mode?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your storefront will accept new orders again. Existing orders are not
            affected.
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
            className="min-h-[44px] rounded-lg bg-[#F59E0B] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#D97706] disabled:opacity-50"
          >
            {loading ? "Disabling…" : "Disable vacation mode"}
          </button>
        </div>
      </div>
    </div>
  );
}
