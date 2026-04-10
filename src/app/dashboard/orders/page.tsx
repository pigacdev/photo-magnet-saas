"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { SellerPrintStatusBadge } from "@/lib/sellerOrderPrintStatus";

export type SellerOrderListItem = {
  id: string;
  status: string;
  /** Server-derived: PAID or PENDING_CASH — OK to produce / print. */
  readyToPrint: boolean;
  contextType: "EVENT" | "STOREFRONT";
  totalPrice: string;
  currency: string;
  createdAt: string;
  imageCount: number;
};

function shortId(id: string) {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

export default function OrdersListPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<SellerOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SellerOrderListItem[]>("/api/orders")
      .then(setOrders)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function formatMoney(amount: string, currency: string) {
    const n = Number(amount);
    if (Number.isNaN(n)) return amount;
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "EUR",
    }).format(n);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
          Orders
        </h1>
        <p className="mt-2 text-[#6B7280]">
          Read-only list of orders from your events and storefronts.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[#6B7280]">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : orders.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-[#6B7280]">No orders yet.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-lg border border-gray-200 md:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-[#F9FAFB] text-[#6B7280]">
                <tr>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Images</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    role="link"
                    tabIndex={0}
                    className="cursor-pointer border-b border-gray-100 transition-colors last:border-0 hover:bg-[#F9FAFB]"
                    onClick={() => router.push(`/dashboard/orders/${o.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        router.push(`/dashboard/orders/${o.id}`);
                    }}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[#111111]">
                      {shortId(o.id)}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <SellerPrintStatusBadge status={o.status} />
                        {o.readyToPrint && (
                          <p className="mt-1 text-xs font-medium text-[#16A34A]">
                            Ready to print
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#111111]">
                      {o.contextType}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[#111111]">
                      {o.imageCount}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[#111111]">
                      {formatMoney(o.totalPrice, o.currency)}
                    </td>
                    <td className="px-4 py-3 text-[#6B7280]">
                      {formatDate(o.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="flex flex-col gap-3 md:hidden">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/dashboard/orders/${o.id}`}
                  className="block rounded-lg border border-gray-200 p-4 transition-colors active:bg-[#F9FAFB]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs text-[#111111]">
                      {shortId(o.id)}
                    </span>
                    <div className="text-right">
                      <SellerPrintStatusBadge status={o.status} />
                      {o.readyToPrint && (
                        <p className="mt-1 text-xs font-medium text-[#16A34A]">
                          Ready to print
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-[#6B7280]">Type</p>
                      <p className="text-[#111111]">{o.contextType}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#6B7280]">Images</p>
                      <p className="tabular-nums text-[#111111]">
                        {o.imageCount}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-[#6B7280]">Total</p>
                      <p className="font-medium text-[#111111]">
                        {formatMoney(o.totalPrice, o.currency)}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-[#6B7280]">Created</p>
                      <p className="text-[#6B7280]">{formatDate(o.createdAt)}</p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
