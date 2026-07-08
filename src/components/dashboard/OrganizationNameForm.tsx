"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { mergeCachedOrganizationUsage } from "@/lib/auth";
import { ORGANIZATION_NAME_MAX_LEN } from "@/lib/organizationName";

type OrganizationNameFormProps = {
  initialName: string | null;
  showHint?: boolean;
  onSaved?: (name: string) => void;
};

export function OrganizationNameForm({
  initialName,
  showHint = false,
  onSaved,
}: OrganizationNameFormProps) {
  const [name, setName] = useState(initialName ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const dirty = name.trim() !== (initialName?.trim() ?? "");

  useEffect(() => {
    setName(initialName ?? "");
  }, [initialName]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Shop name is required");
      return;
    }
    setError("");
    setSaved(false);
    setLoading(true);
    try {
      const result = await api<{ name: string }>("/api/organization/settings", {
        method: "PATCH",
        body: { name: trimmed },
      });
      mergeCachedOrganizationUsage({ name: result.name });
      setSaved(true);
      onSaved?.(result.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save shop name");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      {showHint ? (
        <p className="text-sm text-muted-foreground">
          Add a shop name to personalize customer emails.
        </p>
      ) : null}
      <div>
        <label
          htmlFor="organization-name"
          className="block text-sm font-medium text-foreground"
        >
          Shop name
        </label>
        <input
          id="organization-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          required
          maxLength={ORGANIZATION_NAME_MAX_LEN}
          placeholder="Your business or shop name"
          className="mt-1.5 block w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Shown in customer emails and used for your shop branding.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-[#DC2626]" role="alert">
          {error}
        </p>
      ) : null}

      {saved ? (
        <p className="text-sm text-emerald-600">Shop name saved.</p>
      ) : null}

      <button
        type="submit"
        disabled={loading || !dirty}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save shop name"}
      </button>
    </form>
  );
}
