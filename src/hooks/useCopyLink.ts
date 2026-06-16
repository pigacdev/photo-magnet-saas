"use client";

import { useCallback, useState } from "react";

export function useCopyLink(url: string) {
  const trimmed = url.trim();
  const canCopy = trimmed.length > 0;
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(trimmed);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, [canCopy, trimmed]);

  return { copy, copied, canCopy, trimmed };
}
