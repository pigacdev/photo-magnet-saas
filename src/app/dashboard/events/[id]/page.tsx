"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

type AllowedShape = {
  id: string;
  shapeType: string;
  widthMm: number;
  heightMm: number;
  displayOrder: number;
};

type PricingRule = {
  id: string;
  type: "PER_ITEM" | "BUNDLE";
  price: string;
  currency: string;
  quantity: number | null;
  displayOrder: number;
};

type Event = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isOpen: boolean;
  status: "upcoming" | "active" | "ended";
  shapes: AllowedShape[];
  pricing: PricingRule[];
};

const STATUS_BADGE: Record<Event["status"], { label: string; className: string }> = {
  upcoming: {
    label: "Upcoming",
    className: "bg-blue-50 text-[#2563EB]",
  },
  active: {
    label: "Active",
    className: "bg-green-50 text-[#16A34A]",
  },
  ended: {
    label: "Ended",
    className: "bg-gray-100 text-[#6B7280]",
  },
};

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ event: Event }>(`/api/events/${params.id}`)
      .then((data) => setEvent(data.event))
      .catch(() => setError("Event not found"))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function handleToggleActive() {
    if (!event) return;
    const updated = await api<{ event: Event }>(`/api/events/${event.id}`, {
      method: "PATCH",
      body: { isActive: !event.isActive },
    });
    setEvent(updated.event);
  }

  async function handleDelete() {
    if (!event) return;
    await api(`/api/events/${event.id}`, { method: "DELETE" });
    router.push("/dashboard/events");
  }

  async function handleRemoveShape(shapeId: string) {
    if (!event) return;
    try {
      await api(`/api/events/${event.id}/shapes/${shapeId}`, { method: "DELETE" });
      setEvent({ ...event, shapes: event.shapes.filter((s) => s.id !== shapeId) });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove shape");
    }
  }

  async function handlePricingUpdate(pricing: PricingRule[]) {
    if (!event) return;
    setEvent({ ...event, pricing });
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (loading) {
    return <p className="text-sm text-[#6B7280]">Loading…</p>;
  }

  if (error || !event) {
    return (
      <div>
        <p className="text-sm text-[#DC2626]">{error || "Event not found"}</p>
        <Link href="/dashboard/events" className="mt-2 inline-block text-sm text-[#2563EB]">
          Back to events
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8">
      <div>
        <Link
          href="/dashboard/events"
          className="-ml-1 inline-block rounded-md px-1 py-0.5 text-sm text-[#6B7280] transition-colors hover:bg-[#F9FAFB] hover:text-[#111111]"
        >
          &larr; All events
        </Link>

        <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
            {event.name}
          </h1>
          <div className="mt-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[event.status].className}`}>
              {STATUS_BADGE[event.status].label}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleToggleActive}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F9FAFB]"
          >
            {event.isActive ? "Deactivate" : "Activate"}
          </button>
          <button
            onClick={handleDelete}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-[#DC2626] transition-colors hover:bg-red-50"
          >
            Delete
          </button>
        </div>
        </div>
      </div>

      <dl className="space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-[#6B7280]">Start</dt>
          <dd className="text-[#111111]">{formatDate(event.startDate)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[#6B7280]">End</dt>
          <dd className="text-[#111111]">{formatDate(event.endDate)}</dd>
        </div>
      </dl>

      <div>
        <h2 className="text-lg font-medium text-[#111111]">Shapes</h2>
        {event.shapes.length === 0 ? (
          <p className="mt-3 text-sm text-[#6B7280]">No shapes configured.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {event.shapes.map((shape) => (
              <li
                key={shape.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-sm"
              >
                <span className="text-[#111111]">
                  {shape.shapeType.charAt(0) + shape.shapeType.slice(1).toLowerCase()}{" "}
                  {shape.widthMm}×{shape.heightMm} mm
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveShape(shape.id)}
                  className="text-sm font-medium text-[#DC2626] transition-colors hover:bg-red-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-lg font-medium text-[#111111]">Pricing</h2>
        {event.pricing.length === 0 ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Pricing not configured — customers cannot create orders until pricing is set.
          </p>
        ) : (
          <PricingPreview pricing={event.pricing} />
        )}
        <PricingEditor
          eventId={event.id}
          pricing={event.pricing}
          onUpdate={handlePricingUpdate}
        />
      </div>
    </div>
  );
}

function PricingEditor({
  eventId,
  pricing,
  onUpdate,
}: {
  eventId: string;
  pricing: PricingRule[];
  onUpdate: (pricing: PricingRule[]) => void;
}) {
  const currentMode = pricing.length > 0 ? pricing[0].type : null;

  const [mode, setMode] = useState<"PER_ITEM" | "BUNDLE">(currentMode || "PER_ITEM");
  const [perItemPrice, setPerItemPrice] = useState(
    currentMode === "PER_ITEM" ? pricing[0].price : "",
  );
  const [bundles, setBundles] = useState<{ quantity: string; price: string }[]>(
    currentMode === "BUNDLE"
      ? pricing.map((p) => ({ quantity: String(p.quantity ?? ""), price: p.price }))
      : [{ quantity: "", price: "" }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

        const data = await api<{ pricing: PricingRule[] }>(
          `/api/pricing/event/${eventId}`,
          { method: "PUT", body: { mode: "PER_ITEM", price } },
        );
        onUpdate(data.pricing);
      } else {
        const parsed = bundles.map((b) => ({
          quantity: parseInt(b.quantity),
          price: parseFloat(b.price),
        }));

        if (parsed.some((b) => !b.quantity || b.quantity <= 0 || !b.price || b.price <= 0)) {
          setError("Each bundle must have quantity and price greater than 0");
          setSaving(false);
          return;
        }

        const data = await api<{ pricing: PricingRule[] }>(
          `/api/pricing/event/${eventId}`,
          { method: "PUT", body: { mode: "BUNDLE", bundles: parsed } },
        );
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
      await api(`/api/pricing/event/${eventId}`, { method: "DELETE" });
      onUpdate([]);
      setPerItemPrice("");
      setBundles([{ quantity: "", price: "" }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear pricing");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex gap-2">
        <button
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

      {mode === "PER_ITEM" ? (
        <div>
          <label htmlFor="perItemPrice" className="block text-sm font-medium text-[#111111]">
            Price per magnet (EUR)
          </label>
          <input
            id="perItemPrice"
            type="number"
            step="0.01"
            min="0.01"
            value={perItemPrice}
            onChange={(e) => setPerItemPrice(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-[#111111] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] focus:outline-none"
            placeholder="e.g. 4.00"
          />
        </div>
      ) : (
        <div className="space-y-3">
          {bundles.map((bundle, i) => (
            <div key={i} className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-[#111111]">
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
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

      {error && <p className="text-sm text-[#DC2626]">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save pricing"}
        </button>
        {pricing.length > 0 && (
          <button
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

function PricingPreview({ pricing }: { pricing: PricingRule[] }) {
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
