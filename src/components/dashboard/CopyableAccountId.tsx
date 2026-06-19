"use client";

import { useCallback, useState } from "react";

type CopyableAccountIdProps = {
  accountId: string;
  variant?: "inline" | "definition-list";
  helperText?: string;
  showLabel?: boolean;
};

export function CopyableAccountId({
  accountId,
  variant = "inline",
  helperText,
  showLabel = true,
}: CopyableAccountIdProps) {
  const [copied, setCopied] = useState(false);

  const copyAccountId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(accountId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, [accountId]);

  const idRow = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-sm text-muted-foreground break-all">{accountId}</span>
      <button
        type="button"
        onClick={() => void copyAccountId()}
        aria-label="Copy account ID"
        className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-background/80"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );

  if (variant === "definition-list") {
    return (
      <div>
        <dt className="text-muted-foreground">Account ID</dt>
        <dd className="mt-0.5">{idRow}</dd>
        {helperText ? (
          <dd className="mt-1 text-xs text-muted-foreground">{helperText}</dd>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {showLabel ? (
        <p className="text-sm font-medium text-foreground">Account ID</p>
      ) : null}
      <div className={showLabel ? "mt-0.5" : undefined}>{idRow}</div>
      {helperText ? (
        <p className="mt-1 text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}
