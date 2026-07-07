"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useNewOrderNotifications } from "@/hooks/useNewOrderNotifications";

const AUTO_DISMISS_MS = 5_000;

function formatOrderAmount(amount: string, currency: string): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return amount;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "EUR",
  }).format(n);
}

function formatMagnetCount(count: number): string {
  return count === 1 ? "1 magnet" : `${count} magnets`;
}

function ShoppingCartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.5 5M17 13l2.5 5M9 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm8 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path strokeLinecap="round" d="M5 5l10 10M15 5 5 15" />
    </svg>
  );
}

export function NewOrderNotification() {
  const { activeNotification, dismissNotification } = useNewOrderNotifications();
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!activeNotification) {
      setEntered(false);
      return;
    }
    setEntered(false);
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [activeNotification?.id]);

  useEffect(() => {
    if (!activeNotification) return;
    const id = activeNotification.id;
    const timeoutId = window.setTimeout(() => {
      dismissNotification(id);
    }, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timeoutId);
  }, [activeNotification, dismissNotification]);

  if (!activeNotification) return null;

  const displayName = activeNotification.customerName?.trim() || "Guest";
  const amount = formatOrderAmount(
    activeNotification.totalPrice,
    activeNotification.currency,
  );
  const magnetLabel = formatMagnetCount(activeNotification.magnetCount);

  return (
    <div className="pointer-events-none fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-50 w-[min(92vw,22rem)] -translate-x-1/2">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto transition-all duration-300 ease-out ${
          entered ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
      >
        <div className="relative overflow-hidden rounded-2xl border border-green-100 bg-white shadow-[0_8px_30px_rgba(22,163,74,0.12),0_2px_8px_rgba(0,0,0,0.06)] dark:border-green-900/40 dark:bg-card dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[#16A34A]"
            aria-hidden
          />

          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => dismissNotification(activeNotification.id)}
            className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            <CloseIcon className="size-4" />
          </button>

          <Link
            href={`/dashboard/orders/${activeNotification.id}`}
            onClick={() => dismissNotification(activeNotification.id)}
            className="flex items-center gap-3.5 px-4 py-4 pr-10 transition-colors hover:bg-green-50/60 dark:hover:bg-green-950/20"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#16A34A] text-white shadow-[0_4px_12px_rgba(22,163,74,0.35)] ring-4 ring-green-100 dark:ring-green-900/50">
              <ShoppingCartIcon className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-tight text-foreground">
                New order!
              </p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {displayName}
              </p>
              <p className="mt-1.5 text-sm leading-snug">
                <span className="text-muted-foreground">{magnetLabel}</span>
                <span className="mx-1.5 text-muted-foreground/50" aria-hidden>
                  ·
                </span>
                <span className="font-semibold text-[#16A34A] dark:text-green-400">
                  {amount}
                </span>
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
