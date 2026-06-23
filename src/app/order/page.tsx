"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { OrderShell } from "@/components/order/OrderShell";
import { OrderStepHeader } from "@/components/order/OrderStepHeader";
import { orderBtnPrimary, orderLoadingScreen } from "@/components/order/orderUi";
import { getSafeOrderReturnTo } from "@/lib/orderReturnTo";
import { bestBundleId, shapeLabel } from "@/lib/orderSelectionUi";
import { DEFAULT_SIZE_UNIT } from "@/lib/magnetSize";
import type {
  CatalogPricing,
  CatalogShape,
  DisplayPreferences,
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
  const router = useRouter();
  const [session, setSession] = useState<OrderSessionPayload | null>(null);
  const [shapes, setShapes] = useState<CatalogShape[]>([]);
  const [pricing, setPricing] = useState<CatalogPricing[]>([]);
  const [displayPreferences, setDisplayPreferences] =
    useState<DisplayPreferences>({
      dateFormat: "DMY",
      sizeUnit: DEFAULT_SIZE_UNIT,
    });
  const [loading, setLoading] = useState(true);
  const [entryHref, setEntryHref] = useState("/");
  const [patchError, setPatchError] = useState("");
  const [saving, setSaving] = useState(false);
  const initRef = useRef(false);
  const sessionRef = useRef<OrderSessionPayload | null>(null);
  sessionRef.current = session;

  const patchGenRef = useRef(0);
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
        if (d.displayPreferences) {
          setDisplayPreferences(d.displayPreferences);
        }
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

  const goToPhotos = () => {
    if (!canContinue || saving) return;
    const q =
      typeof window !== "undefined" ? window.location.search : "";
    router.push(`/order/photos${q}`);
  };

  if (loading) {
    return (
      <div className={orderLoadingScreen}>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const currency = pricing[0]?.currency ?? "EUR";
  const perItemRow = pricing.find((p) => p.type === "per_item");
  const priceSummaryLabel = primaryPerItem ? "Price per magnet" : "Total";
  const priceSummaryAmount = primaryPerItem
    ? perItemRow != null
      ? Number(perItemRow.price)
      : session.totalPrice
    : session.totalPrice;

  return (
    <OrderShell contentWidth="medium" className="pb-10">
      <div className="flex flex-col gap-6" aria-busy={saving}>
        <OrderStepHeader
          title="Shape & price"
          subtitle="Tap a shape, then confirm pricing."
          step={{ current: 1, total: 5, label: "Shape & price" }}
        />

      {patchError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {patchError}
        </p>
      )}

      {shapes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No shapes are available for this event or store.
        </p>
      ) : (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Shape
          </h2>
          <div className="mt-3 flex flex-col gap-3">
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
                  className={`w-full rounded-2xl border-2 px-4 py-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? "border-primary bg-background shadow-sm"
                      : "border-border bg-background active:bg-surface"
                  }`}
                >
                  <span className="block text-sm font-medium leading-snug text-foreground">
                    {shapeLabel(s, displayPreferences.sizeUnit)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {!primaryPerItem && bundleMode && bundles.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Bundle
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {bundles.map((b) => {
              const selected = session.bundleId === b.id;
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
                      ? "border-primary bg-background shadow-sm"
                      : "border-border bg-background active:bg-surface"
                  }`}
                >
                  <span className="text-base font-medium text-foreground">
                    {b.quantity} for {formatMoney(Number(b.price), b.currency)}
                  </span>
                  {selected ? (
                    <span className="text-sm font-medium text-primary">Selected</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Choose</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-border bg-background px-4 py-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {priceSummaryLabel}
            </p>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {formatMoney(priceSummaryAmount, currency)}
            </p>
          </div>
          {saving && (
            <span className="text-xs text-muted-foreground">Saving…</span>
          )}
        </div>
      </section>

      <button
        type="button"
        disabled={!canContinue || saving}
        onClick={goToPhotos}
        className={orderBtnPrimary}
      >
        Continue
      </button>

      <Link
        href={entryHref}
        className="text-center text-sm text-primary underline-offset-4 hover:underline"
      >
        {entryHref === "/" ? "Home" : "Back to entry"}
      </Link>
      </div>
    </OrderShell>
  );
}
