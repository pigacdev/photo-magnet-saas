"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { invalidateAuthCache } from "@/lib/auth";
import { CURRENT_POLICY_VERSION, LEGAL_LINKS } from "@/lib/legalConstants";

export type LegalReconsentModalProps = {
  onCompleted: () => void;
};

export function LegalReconsentModal({ onCompleted }: LegalReconsentModalProps) {
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const submit = useCallback(async () => {
    if (!accepted) return;
    setSaving(true);
    setError("");
    try {
      await api("/api/organization/legal-acceptance", {
        method: "PATCH",
        body: { version: CURRENT_POLICY_VERSION },
      });
      invalidateAuthCache();
      onCompleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save acceptance");
    } finally {
      setSaving(false);
    }
  }, [accepted, onCompleted]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-reconsent-title"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl">
        <h2 id="legal-reconsent-title" className="text-lg font-semibold text-foreground">
          Review updated terms
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Please read and accept our current Terms of Service and Privacy Policy to
          continue using Magnetoo.
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm text-foreground">
            I agree to the{" "}
            <Link href={LEGAL_LINKS.terms} className="text-primary underline" target="_blank">
              Terms of Service
            </Link>{" "}
            and acknowledge the{" "}
            <Link href={LEGAL_LINKS.privacy} className="text-primary underline" target="_blank">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        {error ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={!accepted || saving}
          onClick={() => void submit()}
          className="mt-6 w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
