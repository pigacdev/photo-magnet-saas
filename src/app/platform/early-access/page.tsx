"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchPlatformEarlyAccess,
  patchPlatformEarlyAccessDiscount,
  type PlatformEarlyAccessResponse,
  type PlatformEarlyAccessRow,
} from "@/lib/platformApi";
import { planDisplayName } from "@/lib/planCatalog";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function DiscountToggle({
  row,
  onDiscountChange,
}: {
  row: PlatformEarlyAccessRow;
  onDiscountChange: (orgId: string, grantLifetimeDiscount: boolean) => void;
}) {
  const [pending, setPending] = useState(false);

  async function toggle() {
    const previous = row.grantLifetimeDiscount;
    const next = !previous;
    onDiscountChange(row.id, next);
    setPending(true);
    try {
      await patchPlatformEarlyAccessDiscount(row.id, next);
    } catch (err) {
      onDiscountChange(row.id, previous);
      console.error(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void toggle()}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 ${
        row.grantLifetimeDiscount
          ? "border-primary bg-primary"
          : "border-muted-foreground/35 bg-muted/80 dark:border-muted-foreground/50 dark:bg-muted"
      }`}
      role="switch"
      aria-checked={row.grantLifetimeDiscount}
      aria-label={`Lifetime discount for ${row.email}`}
    >
      <span
        className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow-md ring-1 ring-black/10 transition-transform dark:ring-white/20 ${
          row.grantLifetimeDiscount ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function PlatformEarlyAccessPage() {
  const [data, setData] = useState<PlatformEarlyAccessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPlatformEarlyAccess();
      setData(result);
    } catch {
      setError("Failed to load early access data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateGrantLifetimeDiscount = useCallback(
    (orgId: string, grantLifetimeDiscount: boolean) => {
      setData((prev) =>
        prev
          ? {
              ...prev,
              rows: prev.rows.map((row) =>
                row.id === orgId ? { ...row, grantLifetimeDiscount } : row,
              ),
            }
          : prev,
      );
    },
    [],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Early access
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sellers on the 60-day launch promo. Toggle lifetime loyalty pricing per
          org before expiry.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Seats taken
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {data.seatsTaken} / {data.seatLimit}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Active early access
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {data.rows.length}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Plans flipped
              </p>
              <p className="mt-2 text-sm font-medium">
                {data.plansFlippedAt
                  ? formatDate(data.plansFlippedAt)
                  : "Not yet"}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Seller</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Expires</th>
                  <th className="px-4 py-3 font-medium text-right">Events</th>
                  <th className="px-4 py-3 font-medium text-right">Orders</th>
                  <th className="px-4 py-3 font-medium">Last activity</th>
                  <th className="px-4 py-3 font-medium">Lifetime discount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No active early-access subscribers.
                    </td>
                  </tr>
                ) : (
                  data.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {row.email}
                        </div>
                        {row.name ? (
                          <div className="text-xs text-muted-foreground">
                            {row.name}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {planDisplayName(row.plan)}
                        {row.clerkPlanSlug ? (
                          <div className="text-xs text-muted-foreground">
                            {row.clerkPlanSlug}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatDate(row.earlyAccessExpiresAt)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.eventCount}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.orderCount}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatDate(row.lastOrderAt)}
                      </td>
                      <td className="px-4 py-3">
                        <DiscountToggle
                          row={row}
                          onDiscountChange={updateGrantLifetimeDiscount}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
