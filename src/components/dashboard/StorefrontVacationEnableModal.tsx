"use client";

import { useEffect, useMemo, useState } from "react";

function todayDateInputValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

export type StorefrontVacationEnableModalProps = {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: (input: {
    vacationFrom: string;
    vacationTo: string;
    vacationNote: string | null;
  }) => void;
};

export function StorefrontVacationEnableModal({
  open,
  loading,
  onClose,
  onConfirm,
}: StorefrontVacationEnableModalProps) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const minEndDate = useMemo(() => todayDateInputValue(), [open]);

  useEffect(() => {
    if (!open) return;
    setFromDate("");
    setToDate("");
    setNote("");
    setError("");
  }, [open]);

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromDate.trim()) {
      setError("Start date is required.");
      return;
    }
    if (!toDate.trim()) {
      setError("End date is required.");
      return;
    }
    if (fromDate > toDate) {
      setError("End date must be on or after the start date.");
      return;
    }
    if (toDate < minEndDate) {
      setError("End date cannot be in the past.");
      return;
    }
    setError("");
    onConfirm({
      vacationFrom: fromDate,
      vacationTo: toDate,
      vacationNote: note.trim() || null,
    });
  }

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
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="storefront-vacation-enable-title"
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-background shadow-xl"
      >
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <h2
            id="storefront-vacation-enable-title"
            className="text-base font-semibold text-foreground sm:text-lg"
          >
            Enable vacation mode
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            New orders will be paused during the selected dates. Customers will see
            your message on the storefront page.
          </p>
        </div>
        <div className="space-y-4 px-4 py-4 sm:px-5">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              disabled={loading}
              required
              className="min-h-[44px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-primary focus:ring-2 disabled:opacity-50"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">To</span>
            <input
              type="date"
              value={toDate}
              min={minEndDate}
              onChange={(e) => setToDate(e.target.value)}
              disabled={loading}
              required
              className="min-h-[44px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-primary focus:ring-2 disabled:opacity-50"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              Note (optional)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              disabled={loading}
              rows={3}
              maxLength={500}
              placeholder="e.g. Back on Monday — thank you for your patience!"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-primary focus:ring-2 disabled:opacity-50"
            />
          </label>
          {error ? (
            <p className="text-sm text-[#DC2626]" role="alert">
              {error}
            </p>
          ) : null}
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
            type="submit"
            disabled={loading}
            className="min-h-[44px] rounded-lg bg-[#F59E0B] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#D97706] disabled:opacity-50"
          >
            {loading ? "Saving…" : "Enable vacation mode"}
          </button>
        </div>
      </form>
    </div>
  );
}
