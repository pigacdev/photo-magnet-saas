"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { api } from "@/lib/api";

export type PricingRule = {
  id: string;
  type: "PER_ITEM" | "BUNDLE";
  price: string;
  currency: string;
  quantity: number | null;
  displayOrder: number | null;
};

export type PricingContextType = "event" | "storefront";

export type PricingEditorOnUpdateMeta = {
  maxMagnetsPerOrder: number | null;
};

export type PricingSavePayload =
  | {
      mode: "PER_ITEM";
      price: number;
      maxMagnetsPerOrder: number | null;
    }
  | {
      mode: "BUNDLE";
      bundles: Array<{ quantity: number; price: number }>;
    };

export type PricingEditorHandle = {
  validate(): { ok: true; payload: PricingSavePayload } | { ok: false; error: string };
  isDirty(): boolean;
};

type PricingEditorProps = {
  contextType: PricingContextType;
  contextId: string;
  initialPricing: PricingRule[];
  /** Business cap for per-item orders; only saved with PER_ITEM pricing. */
  initialMaxMagnetsPerOrder?: number | null;
  onUpdate?: (
    pricing: PricingRule[],
    meta?: PricingEditorOnUpdateMeta,
  ) => void;
  /** When true, hide save/clear buttons; parent submits via ref.validate(). */
  embedded?: boolean;
  /** Called when embedded form fields change (for dirty tracking). */
  onFormChange?: () => void;
};

function pricingApiSegment(contextType: PricingContextType): string {
  return contextType === "event" ? "event" : "storefront";
}

export async function savePricingConfiguration(
  contextType: PricingContextType,
  contextId: string,
  payload: PricingSavePayload,
): Promise<{ pricing: PricingRule[]; maxMagnetsPerOrder?: number | null }> {
  const segment = pricingApiSegment(contextType);
  const basePath = `/api/pricing/${segment}/${contextId}`;

  if (payload.mode === "PER_ITEM") {
    return api<{
      pricing: PricingRule[];
      maxMagnetsPerOrder: number | null;
    }>(basePath, {
      method: "PUT",
      body: {
        mode: "PER_ITEM",
        price: payload.price,
        maxMagnetsPerOrder: payload.maxMagnetsPerOrder,
      },
    });
  }

  const data = await api<{ pricing: PricingRule[] }>(basePath, {
    method: "PUT",
    body: { mode: "BUNDLE", bundles: payload.bundles },
  });
  return data;
}

function validatePricingForm(input: {
  mode: "PER_ITEM" | "BUNDLE";
  perItemPrice: string;
  bundles: { quantity: string; price: string }[];
  maxMagnetsStr: string;
  systemMaxMagnets: number | null;
}):
  | { ok: true; payload: PricingSavePayload }
  | { ok: false; error: string } {
  if (input.mode === "PER_ITEM") {
    const price = parseFloat(input.perItemPrice);
    if (!price || price <= 0) {
      return { ok: false, error: "Price must be greater than 0" };
    }

    const t = input.maxMagnetsStr.trim();
    let maxMagnetsPerOrder: number | null = null;
    if (t !== "") {
      const n = parseInt(t, 10);
      if (Number.isNaN(n) || n < 1) {
        return {
          ok: false,
          error: "Max magnets per order must be a positive integer or empty",
        };
      }
      if (input.systemMaxMagnets !== null && n > input.systemMaxMagnets) {
        return {
          ok: false,
          error: `Maximum allowed is ${input.systemMaxMagnets} magnets per order`,
        };
      }
      maxMagnetsPerOrder = n;
    }

    return { ok: true, payload: { mode: "PER_ITEM", price, maxMagnetsPerOrder } };
  }

  const parsed = input.bundles.map((b) => ({
    quantity: parseInt(b.quantity, 10),
    price: parseFloat(b.price),
  }));

  if (
    parsed.some(
      (b) => !b.quantity || b.quantity <= 0 || !b.price || b.price <= 0,
    )
  ) {
    return {
      ok: false,
      error: "Each bundle must have quantity and price greater than 0",
    };
  }

  if (
    input.systemMaxMagnets !== null &&
    parsed.some((b) => b.quantity > input.systemMaxMagnets!)
  ) {
    return {
      ok: false,
      error: `Bundle cannot exceed ${input.systemMaxMagnets} magnets`,
    };
  }

  return { ok: true, payload: { mode: "BUNDLE", bundles: parsed } };
}

function normalizeBundleRows(
  rows: Array<{ quantity: string; price: string }>,
): Array<{ quantity: number; price: number }> {
  return rows
    .map((row) => ({
      quantity: parseInt(row.quantity, 10),
      price: parseFloat(row.price),
    }))
    .filter(
      (row) =>
        Number.isFinite(row.quantity) &&
        row.quantity > 0 &&
        Number.isFinite(row.price) &&
        row.price > 0,
    )
    .sort((a, b) => a.quantity - b.quantity);
}

export function isPricingEditorDirty(
  initialPricing: PricingRule[],
  initialMaxMagnetsPerOrder: number | null | undefined,
  state: {
    mode: "PER_ITEM" | "BUNDLE";
    perItemPrice: string;
    bundles: Array<{ quantity: string; price: string }>;
    maxMagnetsStr: string;
  },
): boolean {
  const savedMode =
    initialPricing.length > 0 ? initialPricing[0]?.type ?? null : null;

  if (!savedMode) {
    if (state.mode === "PER_ITEM") {
      return (
        state.perItemPrice.trim() !== "" || state.maxMagnetsStr.trim() !== ""
      );
    }
    return state.bundles.some(
      (row) => row.quantity.trim() !== "" || row.price.trim() !== "",
    );
  }

  if (state.mode !== savedMode) return true;

  if (savedMode === "PER_ITEM") {
    const savedPrice = Number(initialPricing[0]?.price);
    const currentPrice = parseFloat(state.perItemPrice);
    const priceChanged =
      !Number.isFinite(currentPrice) ||
      Math.abs(currentPrice - savedPrice) > 0.000001;

    const savedMax =
      initialMaxMagnetsPerOrder == null
        ? ""
        : String(initialMaxMagnetsPerOrder);
    const currentMax = state.maxMagnetsStr.trim();

    return priceChanged || currentMax !== savedMax;
  }

  const savedBundles = initialPricing
    .map((row) => ({
      quantity: row.quantity ?? 0,
      price: Number(row.price),
    }))
    .filter((row) => row.quantity > 0 && Number.isFinite(row.price))
    .sort((a, b) => a.quantity - b.quantity);

  const currentBundles = normalizeBundleRows(state.bundles);

  return JSON.stringify(savedBundles) !== JSON.stringify(currentBundles);
}

export const PricingEditor = forwardRef<PricingEditorHandle, PricingEditorProps>(
  function PricingEditor(
    {
      contextType,
      contextId,
      initialPricing,
      initialMaxMagnetsPerOrder = null,
      onUpdate,
      embedded = false,
      onFormChange,
    },
    ref,
  ) {
    const segment = pricingApiSegment(contextType);
    const basePath = `/api/pricing/${segment}/${contextId}`;

    const currentMode =
      initialPricing.length > 0 ? initialPricing[0].type : null;

    const [mode, setMode] = useState<"PER_ITEM" | "BUNDLE">(
      currentMode || "PER_ITEM",
    );
    const [perItemPrice, setPerItemPrice] = useState(
      currentMode === "PER_ITEM" ? initialPricing[0]?.price ?? "" : "",
    );
    const [bundles, setBundles] = useState<{ quantity: string; price: string }[]>(
      currentMode === "BUNDLE"
        ? initialPricing.map((p) => ({
            quantity: String(p.quantity ?? ""),
            price: p.price,
          }))
        : [{ quantity: "", price: "" }],
    );
    const [maxMagnetsStr, setMaxMagnetsStr] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [systemMaxMagnets, setSystemMaxMagnets] = useState<number | null>(null);

    useEffect(() => {
      api<{ maxMagnetsPerOrder: number }>("/api/system/config")
        .then((r) => setSystemMaxMagnets(r.maxMagnetsPerOrder))
        .catch(() => setSystemMaxMagnets(null));
    }, []);

    useEffect(() => {
      const m =
        initialPricing.length > 0 ? initialPricing[0].type : null;
      setMode(m || "PER_ITEM");
      setPerItemPrice(m === "PER_ITEM" ? initialPricing[0]?.price ?? "" : "");
      setBundles(
        m === "BUNDLE"
          ? initialPricing.map((p) => ({
              quantity: String(p.quantity ?? ""),
              price: p.price,
            }))
          : [{ quantity: "", price: "" }],
      );
    }, [initialPricing, contextId, contextType]);

    useEffect(() => {
      setMaxMagnetsStr(
        initialMaxMagnetsPerOrder === null ||
          initialMaxMagnetsPerOrder === undefined
          ? ""
          : String(initialMaxMagnetsPerOrder),
      );
    }, [initialMaxMagnetsPerOrder, contextId]);

    function notifyFormChange() {
      onFormChange?.();
    }

    useImperativeHandle(ref, () => ({
      validate: () =>
        validatePricingForm({
          mode,
          perItemPrice,
          bundles,
          maxMagnetsStr,
          systemMaxMagnets,
        }),
      isDirty: () =>
        isPricingEditorDirty(initialPricing, initialMaxMagnetsPerOrder, {
          mode,
          perItemPrice,
          bundles,
          maxMagnetsStr,
        }),
    }));

    function addBundle() {
      setBundles([...bundles, { quantity: "", price: "" }]);
      notifyFormChange();
    }

    function removeBundle(i: number) {
      if (bundles.length <= 1) return;
      setBundles(bundles.filter((_, idx) => idx !== i));
      notifyFormChange();
    }

    function updateBundle(i: number, field: "quantity" | "price", value: string) {
      const next = [...bundles];
      next[i] = { ...next[i], [field]: value };
      setBundles(next);
      notifyFormChange();
    }

    async function handleSave() {
      setError("");
      const validated = validatePricingForm({
        mode,
        perItemPrice,
        bundles,
        maxMagnetsStr,
        systemMaxMagnets,
      });
      if (!validated.ok) {
        setError(validated.error);
        return;
      }

      setSaving(true);
      try {
        const data = await savePricingConfiguration(
          contextType,
          contextId,
          validated.payload,
        );
        if (validated.payload.mode === "PER_ITEM") {
          onUpdate?.(data.pricing, {
            maxMagnetsPerOrder: data.maxMagnetsPerOrder ?? null,
          });
        } else {
          onUpdate?.(data.pricing);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save pricing");
      } finally {
        setSaving(false);
      }
    }

    async function handleClear() {
      setSaving(true);
      try {
        await api(basePath, { method: "DELETE" });
        onUpdate?.([]);
        setPerItemPrice("");
        setBundles([{ quantity: "", price: "" }]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to clear pricing");
      } finally {
        setSaving(false);
      }
    }

    const inputId = `perItemPrice-${contextType}-${contextId}`;
    const maxMagnetsId = `maxMagnetsPerOrder-${contextType}-${contextId}`;
    const modeBtn =
      "rounded-lg border px-4 py-2 text-sm font-medium transition-colors";
    const modeActive = `${modeBtn} border-primary bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300`;
    const modeIdle = `${modeBtn} border-border bg-background text-foreground hover:bg-surface`;

    return (
      <div className={embedded ? "space-y-4" : "mt-4 space-y-4"}>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Pricing model</p>
          <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("PER_ITEM");
              notifyFormChange();
            }}
            className={mode === "PER_ITEM" ? modeActive : modeIdle}
          >
            Price per magnet
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("BUNDLE");
              notifyFormChange();
            }}
            className={mode === "BUNDLE" ? modeActive : modeIdle}
          >
            Bundles
          </button>
          </div>
        </div>

        <div className="min-h-[260px]">
          {mode === "PER_ITEM" ? (
            <div className="per-item-section space-y-4">
              <div>
                <label
                  htmlFor={inputId}
                  className="block text-sm font-medium text-foreground"
                >
                  Price per magnet (EUR)
                </label>
                <input
                  id={inputId}
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={perItemPrice}
                  onChange={(e) => {
                    setPerItemPrice(e.target.value);
                    notifyFormChange();
                  }}
                  className="mt-1.5 block w-full rounded-lg border border-border px-3 py-2.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                  placeholder="e.g. 4.00"
                />
              </div>

              <div>
                <label
                  htmlFor={maxMagnetsId}
                  className="block text-sm font-medium text-foreground"
                >
                  Max magnets per order
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional. Limits how many magnets a customer can order.
                  {systemMaxMagnets !== null && (
                    <> System cap is {systemMaxMagnets}.</>
                  )}
                </p>
                <input
                  id={maxMagnetsId}
                  type="number"
                  min={1}
                  max={systemMaxMagnets ?? undefined}
                  step={1}
                  value={maxMagnetsStr}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v !== "" && !/^\d*$/.test(v)) return;
                    setMaxMagnetsStr(v);
                    notifyFormChange();
                  }}
                  disabled={systemMaxMagnets === null}
                  className="mt-1.5 block w-full rounded-lg border border-border px-3 py-2.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
                  placeholder="No limit (system cap still applies)"
                />
              </div>
            </div>
          ) : (
            <div className="bundle-section space-y-3">
              {bundles.map((bundle, i) => (
                <div key={i} className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-foreground">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={systemMaxMagnets ?? undefined}
                      value={bundle.quantity}
                      onChange={(e) => updateBundle(i, "quantity", e.target.value)}
                      className="mt-1.5 block w-full rounded-lg border border-border px-3 py-2.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                      placeholder="e.g. 3"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-foreground">
                      Price (EUR)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={bundle.price}
                      onChange={(e) => updateBundle(i, "price", e.target.value)}
                      className="mt-1.5 block w-full rounded-lg border border-border px-3 py-2.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                      placeholder="e.g. 10.00"
                    />
                  </div>
                  {bundles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBundle(i)}
                      className="mb-0.5 rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-[#DC2626] transition-colors hover:bg-red-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addBundle}
                className="text-sm font-medium text-primary hover:text-[#1d4ed8]"
              >
                + Add bundle option
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-[#DC2626]">{error}</p>}

        {!embedded ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save pricing"}
            </button>
            {initialPricing.length > 0 && (
              <button
                type="button"
                onClick={() => void handleClear()}
                disabled={saving}
                className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-[#DC2626] transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                Clear pricing
              </button>
            )}
          </div>
        ) : null}
      </div>
    );
  },
);

export function PricingPreview({ pricing }: { pricing: PricingRule[] }) {
  const isPer = pricing[0]?.type === "PER_ITEM";

  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Customer sees
      </p>
      {isPer ? (
        <p className="text-sm font-medium text-foreground">
          €{Number(pricing[0].price).toFixed(2)} per magnet
        </p>
      ) : (
        <ul className="space-y-1">
          {pricing.map((p) => (
            <li key={p.id} className="text-sm font-medium text-foreground">
              {p.quantity} for €{Number(p.price).toFixed(2)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
