"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getSafeOrderReturnTo } from "@/lib/orderReturnTo";
import { bestBundleId, shapeLabel } from "@/lib/orderSelectionUi";
import type {
  CatalogPricing,
  CatalogShape,
  GetSessionResponse,
  OrderSessionPayload,
} from "@/lib/orderSessionTypes";

function formatMoney(amount: number | null, currency = "EUR"): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(amount);
}

function selectionComplete(s: OrderSessionPayload): boolean {
  if (!s.selectedShapeId || !s.pricingType) return false;

  const pricingOk =
    (s.pricingType === "per_item" &&
      typeof s.quantity === "number" &&
      s.quantity >= 1) ||
    (s.pricingType === "bundle" &&
      typeof s.bundleId === "string" &&
      s.bundleId.length > 0);

  if (!pricingOk) return false;

  if (
    s.totalPrice == null ||
    Number.isNaN(s.totalPrice) ||
    s.totalPrice <= 0
  ) {
    return false;
  }

  return true;
}

export default function OrderPage() {
  const [session, setSession] = useState<OrderSessionPayload | null>(null);
  const [shapes, setShapes] = useState<CatalogShape[]>([]);
  const [pricing, setPricing] = useState<CatalogPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [entryHref, setEntryHref] = useState("/");
  const [patchError, setPatchError] = useState("");
  const [saving, setSaving] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const initRef = useRef(false);
  const sessionRef = useRef<OrderSessionPayload | null>(null);
  sessionRef.current = session;

  /** Monotonic id for PATCH calls — only the latest completion may update state (out-of-order responses ignored). */
  const patchGenRef = useRef(0);
  /** How many PATCH requests are in flight (rapid taps can overlap). */
  const patchInFlightRef = useRef(0);

  const patchSession = useCallback(async (body: Record<string, unknown>) => {
    if (!sessionRef.current) return;
    const gen = ++patchGenRef.current;
    patchInFlightRef.current += 1;
    setSaving(true);
    setPatchError("");
    try {
      const r = await api<{ session: OrderSessionPayload }>("/api/session", {
        method: "PATCH",
        body,
      });
      if (gen !== patchGenRef.current) return;
      setSession(r.session);
    } catch (e) {
      if (gen !== patchGenRef.current) return;
      setPatchError(e instanceof Error ? e.message : "Could not save");
      try {
        const d = await api<GetSessionResponse>("/api/session");
        if (gen !== patchGenRef.current) return;
        if (d.session) setSession(d.session);
      } catch {
        /* ignore */
      }
    } finally {
      patchInFlightRef.current -= 1;
      if (patchInFlightRef.current === 0) {
        setSaving(false);
      }
    }
  }, []);

  /** Shape change: backend clears pricing first; then we re-apply default pricing for the mode. */
  const selectShape = useCallback(
    async (s: CatalogShape) => {
      const cur = sessionRef.current;
      if (!cur) return;
      if (cur.selectedShapeId === s.id) return;

      const perItem = pricing.some((p) => p.type === "per_item");
      const bundleFallback =
        bestBundleId(pricing) ??
        pricing.find((p) => p.type === "bundle")?.id ??
        null;

      if (cur.selectedShapeId == null) {
        if (perItem) {
          await patchSession({
            selectedShapeId: s.id,
            pricingType: "per_item",
            quantity: 1,
          });
        } else if (bundleFallback) {
          await patchSession({
            selectedShapeId: s.id,
            pricingType: "bundle",
            bundleId: bundleFallback,
          });
        }
        return;
      }

      await patchSession({ selectedShapeId: s.id });
      if (perItem) {
        await patchSession({
          selectedShapeId: s.id,
          pricingType: "per_item",
          quantity: 1,
        });
      } else if (bundleFallback) {
        await patchSession({
          selectedShapeId: s.id,
          pricingType: "bundle",
          bundleId: bundleFallback,
        });
      }
    },
    [pricing, patchSession],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fallback = getSafeOrderReturnTo(params.get("returnTo")) ?? "/";
    setEntryHref(fallback);

    const afterSessionLoss = () => {
      window.location.replace(fallback);
    };

    api<GetSessionResponse>("/api/session")
      .then((d) => {
        if (!d.session) {
          afterSessionLoss();
          return;
        }
        setSession(d.session);
        setShapes(d.shapes);
        setPricing(d.pricing);
      })
      .catch(() => {
        afterSessionLoss();
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (initRef.current) return;
    if (!session || !shapes.length || !pricing.length) return;
    if (session.selectedShapeId) return;

    initRef.current = true;
    const firstShapeId = shapes[0].id;
    const primaryPerItem = pricing.some((p) => p.type === "per_item");

    void (async () => {
      if (primaryPerItem) {
        await patchSession({
          selectedShapeId: firstShapeId,
          pricingType: "per_item",
          quantity: 1,
        });
      } else {
        const bid = bestBundleId(pricing);
        if (bid) {
          await patchSession({
            selectedShapeId: firstShapeId,
            pricingType: "bundle",
            bundleId: bid,
          });
        }
      }
    })();
  }, [session, shapes, pricing, patchSession]);

  const primaryPerItem = pricing.some((p) => p.type === "per_item");
  const bundleMode = pricing.some((p) => p.type === "bundle");
  const bundles = pricing.filter((p) => p.type === "bundle");

  const canContinue = session ? selectionComplete(session) : false;

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

  const currency = pricing[0]?.currency ?? "EUR";

  return (
    <div
      className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 bg-[#FAFAFA] px-4 pb-10 pt-8"
      aria-busy={saving}
    >
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
          Shape &amp; price
        </h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Tap a shape, then confirm pricing.
        </p>
      </header>

      {patchError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {patchError}
        </p>
      )}

      {shapes.length === 0 ? (
        <p className="text-sm text-[#6B7280]">
          No shapes are available for this event or store.
        </p>
      ) : (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
            Shape
          </h2>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {shapes.map((s) => {
              const selected = session.selectedShapeId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    void selectShape(s);
                  }}
                  className={`min-w-[112px] shrink-0 rounded-2xl border-2 px-4 py-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? "border-[#2563EB] bg-white shadow-sm"
                      : "border-gray-200 bg-white active:bg-[#F9FAFB]"
                  }`}
                >
                  <span className="block text-sm font-medium leading-snug text-[#111111]">
                    {shapeLabel(s)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {primaryPerItem && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
            Quantity
          </h2>
          <div className="mt-3 flex items-center justify-center gap-6">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={saving || (session.quantity ?? 1) <= 1}
              onClick={() => {
                const q = Math.max(1, (session.quantity ?? 1) - 1);
                void patchSession({
                  selectedShapeId: session.selectedShapeId ?? shapes[0]?.id,
                  pricingType: "per_item",
                  quantity: q,
                });
              }}
              className="flex h-14 min-w-14 items-center justify-center rounded-2xl border-2 border-gray-300 bg-white text-2xl font-medium text-[#111111] disabled:opacity-40"
            >
              −
            </button>
            <span className="min-w-[3ch] text-center text-3xl font-semibold tabular-nums text-[#111111]">
              {session.quantity ?? 1}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={saving || (session.quantity ?? 1) >= 999}
              onClick={() => {
                const q = Math.min(999, (session.quantity ?? 1) + 1);
                void patchSession({
                  selectedShapeId: session.selectedShapeId ?? shapes[0]?.id,
                  pricingType: "per_item",
                  quantity: q,
                });
              }}
              className="flex h-14 min-w-14 items-center justify-center rounded-2xl border-2 border-gray-300 bg-white text-2xl font-medium text-[#111111] disabled:opacity-40"
            >
              +
            </button>
          </div>
        </section>
      )}

      {!primaryPerItem && bundleMode && bundles.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
            Bundle
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {bundles.map((b) => {
              const selected = session.bundleId === b.id;
              const perMag =
                b.quantity && b.quantity > 0
                  ? Number(b.price) / b.quantity
                  : null;
              return (
                <button
                  key={b.id}
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    void patchSession({
                      selectedShapeId:
                        session.selectedShapeId ?? shapes[0]?.id,
                      pricingType: "bundle",
                      bundleId: b.id,
                    });
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl border-2 px-4 py-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? "border-[#2563EB] bg-white shadow-sm"
                      : "border-gray-200 bg-white active:bg-[#F9FAFB]"
                  }`}
                >
                  <span className="text-base font-medium text-[#111111]">
                    {b.quantity} magnets
                  </span>
                  <span className="text-right">
                    <span className="block text-lg font-semibold text-[#111111]">
                      {formatMoney(Number(b.price), b.currency)}
                    </span>
                    {perMag != null && (
                      <span className="text-xs text-[#6B7280]">
                        {formatMoney(perMag, b.currency)} / magnet
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
              Total
            </p>
            <p className="text-2xl font-bold tabular-nums text-[#111111]">
              {formatMoney(session.totalPrice, currency)}
            </p>
          </div>
          {saving && (
            <span className="text-xs text-[#6B7280]">Saving…</span>
          )}
        </div>
      </section>

      <button
        type="button"
        disabled={!canContinue || saving}
        onClick={() => setAcknowledged(true)}
        className="w-full rounded-2xl bg-[#2563EB] py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Continue
      </button>

      {acknowledged && canContinue && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-center text-sm font-medium text-green-900">
          ✓ Ready to upload photos
        </p>
      )}

      <Link
        href={entryHref}
        className="text-center text-sm text-[#2563EB] underline-offset-4 hover:underline"
      >
        {entryHref === "/" ? "Home" : "Back to entry"}
      </Link>
    </div>
  );
}
