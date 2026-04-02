"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { buildOrderUrlWithReturn } from "@/lib/orderReturnTo";

export default function EventEntryPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    api<{ name: string }>(`/api/public/entry/event/${id}`)
      .then((d) => setName(d.name))
      .catch(() => setError("Event not found"))
      .finally(() => setLoading(false));
  }, [id]);

  async function startOrder() {
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] px-4">
        <p className="text-sm text-[#6B7280]">Loading…</p>
      </div>
    );
  }

  if (!name && error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] px-4">
        <p className="text-center text-sm text-[#DC2626]">{error}</p>
        <Link href="/" className="mt-4 text-sm text-[#2563EB]">
          Home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAFA] px-4 pb-10 pt-12">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-[#111111]">
          {name}
        </h1>
        <p className="mt-2 text-center text-sm text-[#6B7280]">Photo magnets</p>

        {error && (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-800">
            {error}
          </p>
        )}

        <div className="mt-auto pt-16">
          <button
            type="button"
            onClick={startOrder}
            disabled={starting}
            className="w-full rounded-xl bg-[#2563EB] py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#1d4ed8] disabled:opacity-60"
          >
            {starting ? "Starting…" : "Start Order"}
          </button>
        </div>
      </div>
    </div>
  );
}
