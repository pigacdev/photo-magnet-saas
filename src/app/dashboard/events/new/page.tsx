"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type ShapeInput = {
  shapeType: "SQUARE" | "CIRCLE" | "RECTANGLE";
  widthMm: number;
  heightMm: number;
};

const SHAPE_PRESETS: { label: string; value: ShapeInput }[] = [
  { label: "Square 50×50 mm", value: { shapeType: "SQUARE", widthMm: 50, heightMm: 50 } },
  { label: "Square 63×63 mm", value: { shapeType: "SQUARE", widthMm: 63, heightMm: 63 } },
  { label: "Circle 50×50 mm", value: { shapeType: "CIRCLE", widthMm: 50, heightMm: 50 } },
  { label: "Rectangle 50×70 mm", value: { shapeType: "RECTANGLE", widthMm: 50, heightMm: 70 } },
];

function presetKey(s: ShapeInput) {
  return `${s.shapeType}-${s.widthMm}-${s.heightMm}`;
}

export default function NewEventPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedShapes, setSelectedShapes] = useState<Set<string>>(new Set());
  const [payCash, setPayCash] = useState(true);
  const [payCard, setPayCard] = useState(true);
  const [payStripe, setPayStripe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function toggleShape(key: string) {
    setSelectedShapes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Event name is required");
      return;
    }

    if (!startDate || !endDate) {
      setError("Start and end dates are required");
      return;
    }

    if (new Date(startDate) >= new Date(endDate)) {
      setError("Start date must be before end date");
      return;
    }

    if (selectedShapes.size === 0) {
      setError("Select at least one shape");
      return;
    }

    if (!payCash && !payCard && !payStripe) {
      setError("Keep at least one payment option enabled.");
      return;
    }

    const shapes = SHAPE_PRESETS.filter((p) => selectedShapes.has(presetKey(p.value))).map(
      (p) => p.value,
    );

    setLoading(true);

    try {
      await api("/api/events", {
        method: "POST",
        body: {
          name: name.trim(),
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          shapes,
          paymentCashEnabled: payCash,
          paymentCardEnabled: payCard,
          paymentStripeEnabled: payStripe,
        },
      });
      router.push("/dashboard/events");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
          Create event
        </h1>
        <p className="mt-2 text-sm text-[#6B7280]">
          Set up a new event to start accepting orders.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-[#111111]">
            Event name
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] focus:outline-none"
            placeholder="e.g. Smith Wedding"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-[#111111]">
              Start date
            </label>
            <input
              id="startDate"
              type="datetime-local"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-[#111111] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-[#111111]">
              End date
            </label>
            <input
              id="endDate"
              type="datetime-local"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-[#111111] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] focus:outline-none"
            />
          </div>
        </div>

        <fieldset>
          <legend className="block text-sm font-medium text-[#111111]">
            Magnet shapes
          </legend>
          <p className="mt-1 text-sm text-[#6B7280]">
            Choose which shapes customers can order.
          </p>
          <div className="mt-3 space-y-2">
            {SHAPE_PRESETS.map((preset) => {
              const key = presetKey(preset.value);
              return (
                <label
                  key={key}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                    selectedShapes.has(key)
                      ? "border-[#2563EB] bg-blue-50 text-[#111111]"
                      : "border-gray-300 text-[#6B7280] hover:border-gray-400"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedShapes.has(key)}
                    onChange={() => toggleShape(key)}
                    className="sr-only"
                  />
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded border ${
                      selectedShapes.has(key)
                        ? "border-[#2563EB] bg-[#2563EB]"
                        : "border-gray-300"
                    }`}
                  >
                    {selectedShapes.has(key) && (
                      <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  {preset.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="block text-sm font-medium text-[#111111]">
            Payment options
          </legend>
          <p className="mt-1 text-sm text-[#6B7280]">
            Customers see only the methods you enable. At least one must stay on.
          </p>
          <div className="mt-3 space-y-2">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB]"
                checked={payCash}
                onChange={(e) => setPayCash(e.target.checked)}
              />
              <span className="text-sm text-[#111111]">Cash</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB]"
                checked={payCard}
                onChange={(e) => setPayCard(e.target.checked)}
              />
              <span className="text-sm text-[#111111]">Card on location</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB]"
                checked={payStripe}
                onChange={(e) => setPayStripe(e.target.checked)}
              />
              <span className="text-sm text-[#111111]">Pay online (Stripe)</span>
            </label>
          </div>
        </fieldset>

        {error && (
          <p className="text-sm text-[#DC2626]">{error}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create event"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/events")}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F9FAFB]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
