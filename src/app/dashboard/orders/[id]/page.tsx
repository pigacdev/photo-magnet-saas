"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { SellerPrintStatusBadge } from "@/lib/sellerOrderPrintStatus";

type SellerOrderDetail = {
  orderId: string;
  status: string;
  contextType: "EVENT" | "STOREFRONT";
  contextId: string;
  totalPrice: string;
  currency: string;
  createdAt: string;
  images: {
    id: string;
    renderedUrl: string | null;
    position: number;
    shapeId: string;
  }[];
  printSheets: { url: string; widthMm: number; heightMm: number }[];
};

export default function OrderDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [order, setOrder] = useState<SellerOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api<SellerOrderDetail>(`/api/orders/${encodeURIComponent(id)}`)
      .then(setOrder)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  function formatMoney(amount: string, currency: string) {
    const n = Number(amount);
    if (Number.isNaN(n)) return amount;
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "EUR",
    }).format(n);
  }

  function formatMm(n: number): string {
    if (!Number.isFinite(n) || n <= 0) return "";
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
  }

  function printSheetButtonLabel(
    sheet: { widthMm: number; heightMm: number },
    multiple: boolean,
  ): string {
    if (!multiple) return "Print sheet";
    const w = formatMm(sheet.widthMm);
    const h = formatMm(sheet.heightMm);
    if (w && h) return `Print ${w}×${h}`;
    return "Print sheet";
  }

  const hasSheets = Boolean(order?.printSheets.length);

  return (
    <div
      className={`flex flex-col gap-8 ${hasSheets ? "pb-28 md:pb-8" : "pb-8"}`}
    >
      <div>
        <Link
          href="/dashboard/orders"
          className="text-sm font-medium text-[#2563EB] hover:underline"
        >
          ← Orders
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-[#6B7280]">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !order ? (
        <p className="text-sm text-[#6B7280]">Order not found.</p>
      ) : (
        <>
          <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
            <h1 className="text-lg font-semibold text-[#111111] sm:text-xl">
              Order
            </h1>
            <p className="mt-1 break-all font-mono text-xs text-[#6B7280]">
              {order.orderId}
            </p>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                  Status
                </dt>
                <dd className="mt-1">
                  <SellerPrintStatusBadge status={order.status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                  Type
                </dt>
                <dd className="mt-1 text-[#111111]">{order.contextType}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                  Total
                </dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-[#111111]">
                  {formatMoney(order.totalPrice, order.currency)}
                </dd>
              </div>
            </dl>
          </div>

          <div>
            <h2 className="text-base font-semibold text-[#111111]">Images</h2>
            {order.images.length === 0 ? (
              <p className="mt-3 text-sm text-[#6B7280]">
                No images available.
              </p>
            ) : (
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {order.images.map((img) => (
                  <li
                    key={img.id}
                    className="aspect-square overflow-hidden rounded-lg border border-gray-200 bg-[#F9FAFB]"
                  >
                    {img.renderedUrl ? (
                      <img
                        src={img.renderedUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-2 text-center text-xs text-[#6B7280]">
                        Not rendered
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {order && order.printSheets.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-gray-200 bg-white p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] md:relative md:z-0 md:border-0 md:bg-transparent md:p-0 md:shadow-none">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {order.printSheets.map((sheet) => (
              <a
                key={sheet.url}
                href={sheet.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[48px] w-full items-center justify-center rounded-lg bg-[#2563EB] px-4 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] sm:w-auto sm:min-w-[180px]"
              >
                {printSheetButtonLabel(sheet, order.printSheets.length > 1)}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
