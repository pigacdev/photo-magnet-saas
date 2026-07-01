"use client";

import { useEffect } from "react";

export type CustomerDeleteConfirmModalProps = {
  open: boolean;
  customerName: string;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function CustomerDeleteConfirmModal({
  open,
  customerName,
  saving,
  onClose,
  onConfirm,
}: CustomerDeleteConfirmModalProps) {
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
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        onClick={() => {
          if (!saving) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-delete-title"
        className="relative w-full max-w-md rounded-xl border border-border bg-background shadow-xl"
      >
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <h2
            id="customer-delete-title"
            className="text-base font-semibold text-foreground sm:text-lg"
          >
            Delete customer
          </h2>
        </div>

        <div className="space-y-3 px-4 py-4 sm:px-5">
          <p className="text-sm text-muted-foreground">
            Remove <span className="font-medium text-foreground">{customerName}</span>{" "}
            from your customer list? Their past orders will keep the contact
            details entered at checkout.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="min-h-10 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onConfirm}
            className="min-h-10 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? "Deleting…" : "Delete customer"}
          </button>
        </div>
      </div>
    </div>
  );
}
