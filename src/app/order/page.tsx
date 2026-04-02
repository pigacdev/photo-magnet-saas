"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getSafeOrderReturnTo } from "@/lib/orderReturnTo";

type OrderSessionPayload = {
  id: string;
  contextType: "event" | "storefront";
  contextId: string;
  status: string;
  createdAt: string;
  startedAt: string;
  lastActiveAt: string;
  expiresAt: string;
};

export default function OrderPlaceholderPage() {
  const [session, setSession] = useState<OrderSessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [entryHref, setEntryHref] = useState("/");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fallback = getSafeOrderReturnTo(params.get("returnTo")) ?? "/";
    setEntryHref(fallback);

    const afterSessionLoss = () => {
      window.location.replace(fallback);
    };

    api<{ session: OrderSessionPayload | null }>("/api/session")
      .then((d) => {
        if (!d.session) {
          afterSessionLoss();
          return;
        }
        setSession(d.session);
      })
      .catch(() => {
        afterSessionLoss();
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] px-4">
        <p className="text-sm text-[#6B7280]">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 bg-[#FAFAFA] px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
        Session started
      </h1>
      <dl className="space-y-3 rounded-lg border border-gray-200 bg-white px-4 py-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-[#6B7280]">Context</dt>
          <dd className="text-right font-medium text-[#111111]">{session.contextType}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[#6B7280]">Context ID</dt>
          <dd className="break-all text-right font-mono text-xs text-[#111111]">
            {session.contextId}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[#6B7280]">Started</dt>
          <dd className="text-right text-[#111111]">
            {new Date(session.startedAt).toLocaleString()}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[#6B7280]">Last active</dt>
          <dd className="text-right text-[#111111]">
            {new Date(session.lastActiveAt).toLocaleString()}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[#6B7280]">Expires</dt>
          <dd className="text-right text-[#111111]">
            {new Date(session.expiresAt).toLocaleString()}
          </dd>
        </div>
      </dl>
      <Link
        href={entryHref}
        className="text-sm text-[#2563EB] underline-offset-4 hover:underline"
      >
        {entryHref === "/" ? "Home" : "Back to entry"}
      </Link>
    </div>
  );
}
