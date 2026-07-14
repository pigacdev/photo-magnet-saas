"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type TenantDetail = {
  id: string;
  email: string;
  name: string | null;
  businessName: string | null;
  plan: string;
  createdAt: string;
  deletedAt: string | null;
  erasureScheduledAt: string | null;
};

export default function PlatformTenantDetailPage() {
  const params = useParams();
  const orgId = typeof params.id === "string" ? params.id : "";
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await api<TenantDetail>(
        `/api/platform/tenants/${encodeURIComponent(orgId)}`,
      );
      setTenant(data);
    } catch {
      setTenant(null);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function scheduleDelete() {
    if (!tenant || confirmEmail.trim().toLowerCase() !== tenant.email.toLowerCase()) {
      setError("Type the seller email exactly to confirm.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/api/platform/tenants/${encodeURIComponent(orgId)}`, {
        method: "DELETE",
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not schedule deletion");
    } finally {
      setBusy(false);
    }
  }

  async function cancelErasure() {
    setBusy(true);
    setError("");
    try {
      await api(
        `/api/platform/tenants/${encodeURIComponent(orgId)}/cancel-erasure`,
        { method: "POST" },
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!tenant) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600 dark:text-red-400">Tenant not found.</p>
        <Link href="/platform" className="mt-2 inline-block text-sm text-primary underline">
          Back to platform
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link href="/platform" className="text-sm text-muted-foreground hover:text-foreground">
        ← Platform overview
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">{tenant.email}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {tenant.businessName || tenant.name || "—"} · {tenant.plan}
      </p>
      <dl className="mt-6 grid gap-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Org ID</dt>
          <dd className="font-mono">{tenant.id}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Signed up</dt>
          <dd>{new Date(tenant.createdAt).toLocaleString()}</dd>
        </div>
        {tenant.erasureScheduledAt ? (
          <div>
            <dt className="text-muted-foreground">Erasure scheduled</dt>
            <dd>{new Date(tenant.erasureScheduledAt).toLocaleString()}</dd>
          </div>
        ) : null}
      </dl>

      {tenant.erasureScheduledAt ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void cancelErasure()}
          className="mt-6 rounded-lg border border-border px-4 py-2 text-sm font-medium"
        >
          Cancel scheduled deletion
        </button>
      ) : (
        <section className="mt-10 rounded-xl border border-red-200 bg-red-50/60 p-6 dark:border-red-900/50 dark:bg-red-950/25">
          <div className="flex items-start gap-2">
            <span className="text-xl" aria-hidden>
              ⚠️
            </span>
            <div>
              <h2 className="text-lg font-semibold text-red-800 dark:text-red-300">
                Danger zone
              </h2>
              <p className="mt-2 text-sm text-red-900/90 dark:text-red-300/80">
                Permanently delete this seller account, all orders, customers, and
                stored media after the grace period. This action schedules erasure
                and blocks the seller immediately.
              </p>
            </div>
          </div>
          <label className="mt-4 block text-sm">
            <span className="font-medium text-red-900 dark:text-red-200">
              Type{" "}
              <code className="rounded bg-red-100 px-1 dark:bg-red-950/60 dark:text-red-200">
                {tenant.email}
              </code>{" "}
              to confirm
            </span>
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              className="mt-2 w-full rounded-lg border border-red-200 bg-background px-3 py-2 text-sm text-foreground dark:border-red-900/50"
              autoComplete="off"
            />
          </label>
          {error ? (
            <p className="mt-2 text-sm text-red-700 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={
              busy ||
              confirmEmail.trim().toLowerCase() !== tenant.email.toLowerCase()
            }
            onClick={() => void scheduleDelete()}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600"
          >
            {busy ? "Scheduling…" : "Delete seller account"}
          </button>
        </section>
      )}
    </div>
  );
}
