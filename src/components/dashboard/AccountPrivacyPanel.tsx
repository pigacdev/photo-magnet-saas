"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/lib/api";
import { invalidateAuthCache, getMe, type User } from "@/lib/auth";
import { LEGAL_LINKS } from "@/lib/legalConstants";

type AccountPrivacyPanelProps = {
  user: User;
  onUserUpdated: (user: User) => void;
};

export function AccountPrivacyPanel({
  user,
  onUserUpdated,
}: AccountPrivacyPanelProps) {
  const { getToken } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function exportData() {
    setBusy("export");
    setError("");
    try {
      const token = await getToken();
      const res = await fetch("/api/organization/export", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "magnetoo-account-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not export data. Try again from Settings.");
    } finally {
      setBusy(null);
    }
  }

  async function scheduleDeletion() {
    setBusy("delete");
    setError("");
    try {
      await api("/api/organization/delete-account", { method: "POST" });
      invalidateAuthCache();
      const u = await getMe();
      if (u) onUserUpdated(u);
      setConfirmDelete(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not schedule deletion");
    } finally {
      setBusy(null);
    }
  }

  async function cancelDeletion() {
    setBusy("cancel");
    setError("");
    try {
      await api("/api/organization/cancel-account-deletion", { method: "POST" });
      invalidateAuthCache();
      const u = await getMe();
      if (u) onUserUpdated(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel deletion");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-10 rounded-xl border border-border bg-background p-6">
      <h2 className="text-lg font-semibold text-foreground">Privacy & data</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Export your account data or delete your Magnetoo seller account. See our{" "}
        <Link href={LEGAL_LINKS.privacy} className="text-primary underline">
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link href="/dashboard/billing" className="text-primary underline">
          Data Processing Agreement
        </Link>
        .
      </p>

      {user.erasureScheduledAt ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Account deletion scheduled for{" "}
          {new Date(user.erasureScheduledAt).toLocaleString()}. You can cancel
          until then.
          <button
            type="button"
            disabled={busy === "cancel"}
            onClick={() => void cancelDeletion()}
            className="ml-2 font-medium text-primary underline"
          >
            Cancel deletion
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy != null}
          onClick={() => void exportData()}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface"
        >
          {busy === "export" ? "Exporting…" : "Export my data"}
        </button>
        {!user.erasureScheduledAt ? (
          <button
            type="button"
            disabled={busy != null}
            onClick={() => setConfirmDelete(true)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Delete account
          </button>
        ) : null}
      </div>

      {confirmDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-red-200 bg-background p-6">
            <h3 className="text-lg font-semibold text-red-700">Delete account?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This schedules permanent deletion of your shop, orders, and uploaded
              media after the grace period. This cannot be undone after the purge
              runs.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy === "delete"}
                onClick={() => void scheduleDeletion()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white"
              >
                {busy === "delete" ? "Scheduling…" : "Yes, delete my account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
