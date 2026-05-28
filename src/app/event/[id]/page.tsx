"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { buildOrderUrlWithReturn } from "@/lib/orderReturnTo";
import { OrderShell } from "@/components/order/OrderShell";
import { orderBtnPrimary, orderLoadingScreen } from "@/components/order/orderUi";

type EventEntryMeta = {
  name: string;
  canOrder: boolean;
  unavailableReason: string | null;
};

export default function EventEntryPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [meta, setMeta] = useState<EventEntryMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    api<EventEntryMeta>(`/api/public/entry/event/${id}`)
      .then((d) => setMeta(d))
      .catch(() => setError("Event not found"))
      .finally(() => setLoading(false));
  }, [id]);

  async function startOrder() {
    if (!meta?.canOrder) return;
    setStarting(true);
    setError("");
    try {
      await api(`/api/session/start`, {
        method: "POST",
        body: { contextType: "event", contextId: id },
      });
      router.push(buildOrderUrlWithReturn(`/event/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start order");
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div className={orderLoadingScreen}>
        <p className="text-sm text-[#6B7280]">Loading…</p>
      </div>
    );
  }

  if (!meta && error) {
    return (
      <div className={orderLoadingScreen}>
        <p className="text-center text-sm text-[#DC2626]">{error}</p>
        <Link href="/" className="mt-4 text-sm text-[#2563EB]">
          Home
        </Link>
      </div>
    );
  }

  const canOrder = meta?.canOrder ?? false;

  return (
    <OrderShell contentWidth="medium" className="pb-10 pt-4">
      <div className="mx-auto flex w-full flex-1 flex-col">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-[#111111]">
          {meta?.name}
        </h1>
        <p className="mt-2 text-center text-sm text-[#6B7280]">Photo magnets</p>

        {!canOrder && meta?.unavailableReason ? (
          <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950">
            Ordering is not available: {meta.unavailableReason}
          </p>
        ) : null}

        {error && (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-800">
            {error}
          </p>
        )}

        <div className="mt-auto pt-16">
          <button
            type="button"
            onClick={startOrder}
            disabled={starting || !canOrder}
            className={orderBtnPrimary}
          >
            {starting ? "Starting…" : "Start order"}
          </button>
        </div>
      </div>
    </OrderShell>
  );
}
