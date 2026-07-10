"use client";

import { useEffect } from "react";

export type BillingSubscriptionSuccessModalProps = {
  open: boolean;
  onClose: () => void;
};

export function BillingSubscriptionSuccessModal({
  open,
  onClose,
}: BillingSubscriptionSuccessModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="billing-subscription-success-title"
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-background shadow-xl"
      >
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <h2
            id="billing-subscription-success-title"
            className="text-base font-semibold text-foreground sm:text-lg"
          >
            Subscription updated
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your plan change was successful. It may take a moment for usage
            limits to sync across the dashboard.
          </p>
        </div>
        <div className="flex justify-end px-4 py-4 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1d4ed8]"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
