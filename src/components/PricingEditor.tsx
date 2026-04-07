"use client";

import { useEffect, useState } from "react";
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

type PricingEditorProps = {
  contextType: PricingContextType;
  contextId: string;
  initialPricing: PricingRule[];
  /** Business cap for per-item orders; only saved with PER_ITEM pricing. */
  initialMaxMagnetsPerOrder?: number | null;
  onUpdate: (
    pricing: PricingRule[],
    meta?: PricingEditorOnUpdateMeta,
  ) => void;
};

function pricingApiSegment(contextType: PricingContextType): string {
  return contextType === "event" ? "event" : "storefront";
}

export function PricingEditor({
  contextType,
  contextId,
  initialPricing,
  initialMaxMagnetsPerOrder = null,
  onUpdate,
}: PricingEditorProps) {
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
  /** Persisted when switching PER_ITEM ↔ BUNDLE (hidden, not cleared). */
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

  function addBundle() {
    setBundles([...bundles, { quantity: "", price: "" }]);
  }

  function removeBundle(i: number) {
    if (bundles.length <= 1) return;
    setBundles(bundles.filter((_, idx) => idx !== i));
  }

  function updateBundle(i: number, field: "quantity" | "price", value: string) {
    const next = [...bundles];
    next[i] = { ...next[i], [field]: value };
    setBundles(next);
  }

  function validateMaxMagnetsForPerItem():
    | { ok: true; value: number | null }
    | { ok: false; message: string } {
    const t = maxMagnetsStr.trim();
    if (t === "") return { ok: true, value: null };
    const n = parseInt(t, 10);
    if (Number.isNaN(n) || n < 1) {
      return {
        ok: false,
        message:
          "Max magnets per order must be a positive integer or empty",
      };
    }
    if (systemMaxMagnets !== null && n > systemMaxMagnets) {
      return {
        ok: false,
        message: `Maximum allowed is ${systemMaxMagnets} magnets per order`,
      };
    }
    return { ok: true, value: n };
  }

  async function handleSave() {
    setError("");
    setSaving(true);

    try {
      if (mode === "PER_ITEM") {
        const price = parseFloat(perItemPrice);
        if (!price || price <= 0) {
          setError("Price must be greater than 0");
          setSaving(false);
          return;
        }

        const maxCheck = validateMaxMagnetsForPerItem();
        if (!maxCheck.ok) {
          setError(maxCheck.message);
          setSaving(false);
          return;
        }

        const data = await api<{
          pricing: PricingRule[];
          maxMagnetsPerOrder: number | null;
        }>(basePath, {
          method: "PUT",
          body: {
            mode: "PER_ITEM",
            price,
            maxMagnetsPerOrder: maxCheck.value,
          },
        });
        onUpdate(data.pricing, {
          maxMagnetsPerOrder: data.maxMagnetsPerOrder,
        });
      } else {
        const parsed = bundles.map((b) => ({
          quantity: parseInt(b.quantity, 10),
          price: parseFloat(b.price),
        }));

        if (
          parsed.some(
            (b) => !b.quantity || b.quantity <= 0 || !b.price || b.price <= 0,
          )
        ) {
          setError("Each bundle must have quantity and price greater than 0");
          setSaving(false);
          return;
        }

        if (
          systemMaxMagnets !== null &&
          parsed.some((b) => b.quantity > systemMaxMagnets)
        ) {
          setError(
            `Bundle cannot exceed ${systemMaxMagnets} magnets`,
          );
          setSaving(false);
          return;
        }

        const data = await api<{ pricing: PricingRule[] }>(basePath, {
          method: "PUT",
          body: { mode: "BUNDLE", bundles: parsed },
        });
        onUpdate(data.pricing);
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
      onUpdate([]);
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

  return (
    <div className="mt-4 space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("PER_ITEM")}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            mode === "PER_ITEM"
              ? "border-[#2563EB] bg-blue-50 text-[#2563EB]"
              : "border-gray-300 text-[#6B7280] hover:border-gray-400"
          }`}
        >
          Price per magnet
        </button>
        <button
          type="button"
          onClick={() => setMode("BUNDLE")}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            mode === "BUNDLE"
              ? "border-[#2563EB] bg-blue-50 text-[#2563EB]"
              : "border-gray-300 text-[#6B7280] hover:border-gray-400"
          }`}
        >
          Bundles
        </button>
      </div>

      <div className="min-h-[260px]">
        {mode === "PER_ITEM" ? (
          <div className="per-item-section space-y-4">
            <div>
              <label
                htmlFor={inputId}
                className="block text-sm font-medium text-[#111111]"
              >
                Price per magnet (EUR)
              </label>
              <input
                id={inputId}
                type="number"
                step="0.01"
                min="0.01"
                value={perItemPrice}
                onChange={(e) => setPerItemPrice(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-[#111111] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] focus:outline-none"
                placeholder="e.g. 4.00"
              />
            </div>

            <div>
              <label
                htmlFor={maxMagnetsId}
                className="block text-sm font-medium text-[#111111]"
              >
                Max magnets per order
              </label>
              <p className="mt-1 text-xs text-[#6B7280]">
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
                }}
                disabled={systemMaxMagnets === null}
                className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-[#111111] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] focus:outline-none disabled:opacity-50"
                placeholder="No limit (system cap still applies)"
              />
            </div>
          </div>
        ) : (
          <div className="bundle-section space-y-3">
            {bundles.map((bundle, i) => (
              <div key={i} className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-[#111111]">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={systemMaxMagnets ?? undefined}
                    value={bundle.quantity}
                    onChange={(e) => updateBundle(i, "quantity", e.target.value)}
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-[#111111] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] focus:outline-none"
                    placeholder="e.g. 3"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-[#111111]">
                    Price (EUR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={bundle.price}
                    onChange={(e) => updateBundle(i, "price", e.target.value)}
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-[#111111] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] focus:outline-none"
                    placeholder="e.g. 10.00"
                  />
                </div>
                {bundles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBundle(i)}
                    className="mb-0.5 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-[#DC2626] transition-colors hover:bg-red-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addBundle}
              className="text-sm font-medium text-[#2563EB] hover:text-[#1d4ed8]"
            >
              + Add bundle option
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-[#DC2626]">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save pricing"}
        </button>
        {initialPricing.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            disabled={saving}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-[#DC2626] transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            Clear pricing
          </button>
        )}
      </div>
    </div>
  );
}

export function PricingPreview({ pricing }: { pricing: PricingRule[] }) {
  const isPer = pricing[0]?.type === "PER_ITEM";

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-[#F9FAFB] px-4 py-3">
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[#6B7280]">
        Customer sees
      </p>
      {isPer ? (
        <p className="text-sm font-medium text-[#111111]">
          €{Number(pricing[0].price).toFixed(2)} per magnet
        </p>
      ) : (
        <ul className="space-y-1">
          {pricing.map((p) => (
            <li key={p.id} className="text-sm font-medium text-[#111111]">
              {p.quantity} for €{Number(p.price).toFixed(2)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
