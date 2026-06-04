"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { invalidateAuthCache } from "@/lib/auth";
import { CURRENCY_OPTIONS } from "@/lib/currency";

type OnboardingModalProps = {
  onCompleted: () => void;
};

const ONBOARDING_STEPS = [{ id: "currency" as const }] as const;

export function OnboardingModal({ onCompleted }: OnboardingModalProps) {
  const [currency, setCurrency] = useState("EUR");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function blockEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    document.addEventListener("keydown", blockEscape, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", blockEscape, true);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/api/organization/settings", {
        method: "PATCH",
        body: { currency },
      });
      invalidateAuthCache();
      onCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save currency");
    } finally {
      setLoading(false);
    }
  }

  const step = ONBOARDING_STEPS[0];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="onboarding-title"
          className="text-xl font-semibold tracking-tight text-foreground"
        >
          Welcome to Magnetoo
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose the currency for your magnet business. It applies to event and
          storefront pricing, orders, and analytics. Subscription billing stays
          in EUR.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="onboarding-currency"
              className="block text-sm font-medium text-foreground"
            >
              Order currency
            </label>
            <select
              id="onboarding-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={loading}
              className="mt-1.5 block w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            >
              {CURRENCY_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              This choice is permanent and applies to all magnet pricing and
              analytics.
            </p>
          </div>

          {error ? (
            <p className="text-sm text-[#DC2626]" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-60"
          >
            {loading ? "Saving…" : "Continue"}
          </button>
        </form>

        {ONBOARDING_STEPS.length > 1 ? (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Step 1 of {ONBOARDING_STEPS.length}: {step.id}
          </p>
        ) : null}
      </div>
    </div>
  );
}
