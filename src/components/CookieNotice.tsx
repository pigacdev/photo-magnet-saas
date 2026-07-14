"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LEGAL_LINKS } from "@/lib/legalConstants";

const STORAGE_KEY = "cookie_notice_dismissed";

/**
 * Minimal cookie notice for strictly-necessary cookies only.
 * Hook for future CMP: replace this component with a consent manager when
 * adding analytics/marketing cookies — gate those scripts on consent there.
 */
export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "1") {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 p-4 shadow-lg backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          We use strictly necessary cookies to run Magnetoo (sign-in and checkout).
          See our{" "}
          <Link href={LEGAL_LINKS.cookies} className="text-primary underline hover:opacity-90">
            Cookie Policy
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
