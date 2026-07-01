"use client";

import Link from "next/link";
import { useEffect } from "react";
import { formatOrderReference } from "@/lib/orderReference";
import {
  ORDER_STATUS_BADGE_CLASS,
  orderStatusLabel,
  type OrderWorkflowStatus,
} from "@/lib/orderDisplayStatus";
import { formatDisplayDateTime } from "@/lib/dateFormat";

export type CustomerDetailOrder = {
  id: string;
  shortCode: string | null;
  status: string;
  totalPrice: string;
  currency: string;
  createdAt: string;
};

export type CustomerDetailModalProps = {
  open: boolean;
  loading: boolean;
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    customerSince: string;
  } | null;
  orders: CustomerDetailOrder[];
  onClose: () => void;
};

function formatMoney(amount: string, currency: string): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return amount;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.trim() || "EUR",
  }).format(n);
}

function OrderStatusBadge({ status }: { status: string }) {
  const key = status as OrderWorkflowStatus;
  const badgeClass =
    ORDER_STATUS_BADGE_CLASS[key] ?? "bg-gray-100 text-muted-foreground";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${badgeClass}`}
    >
      {orderStatusLabel(status)}
    </span>
  );
}

export function CustomerDetailModal({
  open,
  loading,
  customer,
  orders,
  onClose,
}: CustomerDetailModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-detail-title"
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-background shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div>
            <h2
              id="customer-detail-title"
              className="text-base font-semibold text-foreground sm:text-lg"
            >
              {customer?.name ?? "Customer details"}
            </h2>
            {customer ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Customer since{" "}
                {formatDisplayDateTime(customer.customerSince)}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-surface hover:text-foreground"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 px-4 py-3 sm:px-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : customer ? (
            <>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Email
                  </dt>
                  <dd className="mt-0.5 text-foreground">
                    {customer.email?.trim() || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Phone
                  </dt>
                  <dd className="mt-0.5 text-foreground">
                    {customer.phone?.trim() || "—"}
                  </dd>
                </div>
              </dl>

              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Orders
                </h3>
                {orders.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No orders linked to this customer.
                  </p>
                ) : (
                  <div className="mt-2 overflow-x-auto rounded-lg border border-border">
                    <table className="min-w-full text-sm">
                      <thead className="border-b border-border bg-surface/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Order</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {orders.map((o) => (
                          <tr key={o.id} className="hover:bg-surface/40">
                            <td className="px-3 py-2">
                              <Link
                                href={`/dashboard/orders/${encodeURIComponent(o.id)}`}
                                className="font-medium text-primary hover:underline"
                                onClick={onClose}
                              >
                                {formatOrderReference(o)}
                              </Link>
                              <p className="text-xs text-muted-foreground">
                                {formatDisplayDateTime(o.createdAt)}
                              </p>
                            </td>
                            <td className="px-3 py-2">
                              <OrderStatusBadge status={o.status} />
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatMoney(o.totalPrice, o.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-red-600">Could not load customer.</p>
          )}
        </div>
      </div>
    </div>
  );
}
