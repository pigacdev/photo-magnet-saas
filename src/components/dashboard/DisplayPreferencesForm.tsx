"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  mergeCachedOrganizationUsage,
  type DisplayPreferences,
} from "@/lib/auth";
import {
  DATE_FORMAT_OPTIONS,
  getDateFormatLabel,
  type DateFormat,
} from "@/lib/dateFormat";
import {
  getSizeUnitLabel,
  SIZE_UNIT_OPTIONS,
  type SizeUnit,
} from "@/lib/magnetSize";

type DisplayPreferencesFormProps = {
  initial: DisplayPreferences;
  onSaved?: (saved: DisplayPreferences) => void;
};

export function DisplayPreferencesForm({
  initial,
  onSaved,
}: DisplayPreferencesFormProps) {
  const [dateFormat, setDateFormat] = useState<DateFormat>(initial.dateFormat);
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>(initial.sizeUnit);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const dirty =
    dateFormat !== initial.dateFormat || sizeUnit !== initial.sizeUnit;

  useEffect(() => {
    setDateFormat(initial.dateFormat);
    setSizeUnit(initial.sizeUnit);
  }, [initial.dateFormat, initial.sizeUnit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setError("");
    setSaved(false);
    setLoading(true);
    try {
      const result = await api<{
        dateFormat: DateFormat;
        sizeUnit: SizeUnit;
      }>("/api/organization/settings", {
        method: "PATCH",
        body: { dateFormat, sizeUnit },
      });
      const saved: DisplayPreferences = {
        dateFormat: result.dateFormat,
        sizeUnit: result.sizeUnit,
      };
      mergeCachedOrganizationUsage(saved);
      setSaved(true);
      onSaved?.(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save preferences");
    } finally {
      setLoading(false);
    }
  }

  const current = { dateFormat, sizeUnit };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <div>
        <label
          htmlFor="account-date-format"
          className="block text-sm font-medium text-foreground"
        >
          Date format
        </label>
        <select
          id="account-date-format"
          value={dateFormat}
          onChange={(e) => {
            setDateFormat(e.target.value as DateFormat);
            setSaved(false);
          }}
          disabled={loading}
          className="mt-1.5 block w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
        >
          {DATE_FORMAT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          Current: {getDateFormatLabel(current.dateFormat)}.
          Display only — stored dates are unchanged.
        </p>
      </div>

      <div>
        <label
          htmlFor="account-size-unit"
          className="block text-sm font-medium text-foreground"
        >
          Magnet size unit
        </label>
        <select
          id="account-size-unit"
          value={sizeUnit}
          onChange={(e) => {
            setSizeUnit(e.target.value as SizeUnit);
            setSaved(false);
          }}
          disabled={loading}
          className="mt-1.5 block w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
        >
          {SIZE_UNIT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          Current: {getSizeUnitLabel(current.sizeUnit)}. Display
          only — print sizes stay in mm.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-[#DC2626]" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm text-muted-foreground">Preferences saved.</p>
      ) : null}

      <button
        type="submit"
        disabled={loading || !dirty}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save display preferences"}
      </button>
    </form>
  );
}
