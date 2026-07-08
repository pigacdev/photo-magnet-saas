"use client";

import Link from "next/link";
import { useEffect } from "react";

export type ManualSendEmailUpgradeModalProps = {
  open: boolean;
  onClose: () => void;
};

export function ManualSendEmailUpgradeModal({
  open,
  onClose,
}: ManualSendEmailUpgradeModalProps) {
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
        aria-labelledby="manual-send-email-upgrade-title"
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-background shadow-xl"
      >
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <h2
            id="manual-send-email-upgrade-title"
            className="text-base font-semibold text-foreground sm:text-lg"
          >
            Send email requires Hobby
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manual emails to customers from order details are available on the
            Hobby plan or higher. Free includes buyer confirmations and
            seller order alerts sent by Magnetoo.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface"
          >
            Close
          </button>
          <Link
            href="/dashboard/billing"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1d4ed8]"
          >
            View plans
          </Link>
        </div>
      </div>
    </div>
  );
}
