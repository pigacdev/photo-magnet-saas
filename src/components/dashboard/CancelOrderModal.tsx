"use client";

import { useEffect, useState } from "react";

const MAX_NOTE_LENGTH = 500;

export type CancelOrderModalProps = {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onConfirm: (note: string | null) => void;
};

export function CancelOrderModal({
  open,
  saving,
  onClose,
  onConfirm,
}: CancelOrderModalProps) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) setNote("");
  }, [open]);

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = note.trim();
    onConfirm(trimmed.length > 0 ? trimmed : null);
  }

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
        aria-labelledby="cancel-order-title"
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-background shadow-xl"
      >
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="border-b border-border px-4 py-3 sm:px-5">
            <h2
              id="cancel-order-title"
              className="text-base font-semibold text-foreground sm:text-lg"
            >
              Cancel order
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You can add an optional note for your records. Leave blank to
              cancel without a note.
            </p>
          </div>
          <div className="px-4 py-4 sm:px-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">
                Note <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE_LENGTH))}
                rows={4}
                placeholder="Reason or context for cancellation…"
                disabled={saving}
                className="resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-primary focus:ring-2 disabled:opacity-60"
              />
              <span className="text-xs text-muted-foreground tabular-nums">
                {note.length}/{MAX_NOTE_LENGTH}
              </span>
            </label>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="min-h-[44px] rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface disabled:opacity-50"
            >
              Keep order
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? "Cancelling…" : "Confirm cancellation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
