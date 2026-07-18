"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchPlatformAlertSettings,
  patchPlatformAlertSettings,
  type PlatformAlertSettingsResponse,
} from "@/lib/platformApi";

type AlertToggleKey = "newUserAlertsEnabled" | "planChangeAlertsEnabled";

function AlertToggle({
  label,
  description,
  enabled,
  pending,
  onToggle,
}: {
  label: string;
  description: string;
  enabled: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 ${
          enabled
            ? "border-primary bg-primary"
            : "border-muted-foreground/35 bg-muted/80 dark:border-muted-foreground/50 dark:bg-muted"
        }`}
        role="switch"
        aria-checked={enabled}
        aria-label={`${label}: ${enabled ? "on" : "off"}`}
      >
        <span
          className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow-md ring-1 ring-black/10 transition-transform dark:ring-white/20 ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export default function PlatformNotificationsPage() {
  const [data, setData] = useState<PlatformAlertSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<AlertToggleKey | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPlatformAlertSettings();
      setData(result);
    } catch {
      setError("Failed to load notification settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(key: AlertToggleKey) {
    if (!data) return;
    const previous = data[key];
    const next = !previous;
    setData({ ...data, [key]: next });
    setPendingKey(key);
    try {
      const updated = await patchPlatformAlertSettings({ [key]: next });
      setData(updated);
    } catch (err) {
      setData({ ...data, [key]: previous });
      console.error(err);
      setError("Failed to update notification settings.");
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Notifications
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose which platform ops emails to send. Recipients are every address
          in <code className="text-xs">PLATFORM_ALERT_EMAILS</code>.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error && !data ? (
        <p className="text-sm text-[#DC2626]">{error}</p>
      ) : data ? (
        <div className="rounded-lg border border-border bg-background px-4">
          {error ? (
            <p className="pt-4 text-sm text-[#DC2626]">{error}</p>
          ) : null}
          <AlertToggle
            label="New users"
            description="Email when a new seller account is created."
            enabled={data.newUserAlertsEnabled}
            pending={pendingKey === "newUserAlertsEnabled"}
            onToggle={() => void toggle("newUserAlertsEnabled")}
          />
          <AlertToggle
            label="Subscription plan changes"
            description="Email when a seller moves between Free, Hobby, and Pro."
            enabled={data.planChangeAlertsEnabled}
            pending={pendingKey === "planChangeAlertsEnabled"}
            onToggle={() => void toggle("planChangeAlertsEnabled")}
          />
        </div>
      ) : null}
    </div>
  );
}
