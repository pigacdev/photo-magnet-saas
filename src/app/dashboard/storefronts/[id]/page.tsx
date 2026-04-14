"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  PricingEditor,
  PricingPreview,
  type PricingRule,
} from "@/components/PricingEditor";

type AllowedShape = {
  id: string;
  shapeType: string;
  widthMm: number;
  heightMm: number;
  displayOrder: number;
};

type Storefront = {
  id: string;
  name: string;
  brandText: string | null;
  notificationEmail: string | null;
  sendOrderEmails: boolean;
  isActive: boolean;
  isOpen: boolean;
  createdAt: string;
  maxMagnetsPerOrder: number | null;
  shapes: AllowedShape[];
  pricing: PricingRule[];
};

export default function StorefrontDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [brandDraft, setBrandDraft] = useState("");
  const [brandSaving, setBrandSaving] = useState(false);
  const [notifEmailDraft, setNotifEmailDraft] = useState("");
  const [notifSendDraft, setNotifSendDraft] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);

  const storeUrl = typeof window !== "undefined"
    ? `${window.location.origin}/store/${params.id}`
    : "";

  useEffect(() => {
    api<{ storefront: Storefront }>(`/api/storefronts/${params.id}`)
      .then((data) => {
        setStorefront(data.storefront);
        setBrandDraft(data.storefront.brandText ?? "");
        setNotifEmailDraft(data.storefront.notificationEmail ?? "");
        setNotifSendDraft(data.storefront.sendOrderEmails ?? false);
      })
      .catch(() => setError("Storefront not found"))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function saveOrderNotifications() {
    if (!storefront) return;
    setNotifSaving(true);
    try {
      const updated = await api<{ storefront: Storefront }>(
        `/api/storefronts/${storefront.id}`,
        {
          method: "PATCH",
          body: {
            sendOrderEmails: notifSendDraft,
            notificationEmail:
              notifEmailDraft.trim() === "" ? null : notifEmailDraft.trim(),
          },
        },
      );
      setStorefront({
        ...storefront,
        ...updated.storefront,
        shapes: updated.storefront.shapes ?? storefront.shapes,
        pricing: updated.storefront.pricing ?? storefront.pricing,
      });
      setNotifEmailDraft(updated.storefront.notificationEmail ?? "");
      setNotifSendDraft(updated.storefront.sendOrderEmails ?? false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not save");
    } finally {
      setNotifSaving(false);
    }
  }

  async function saveBrandText() {
    if (!storefront) return;
    setBrandSaving(true);
    try {
      const updated = await api<{ storefront: Storefront }>(
        `/api/storefronts/${storefront.id}`,
        {
          method: "PATCH",
          body: {
            brandText: brandDraft.trim() === "" ? null : brandDraft.trim(),
          },
        },
      );
      setStorefront({
        ...storefront,
        ...updated.storefront,
        shapes: updated.storefront.shapes ?? storefront.shapes,
        pricing: updated.storefront.pricing ?? storefront.pricing,
      });
      setBrandDraft(updated.storefront.brandText ?? "");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBrandSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!storefront) return;
    const updated = await api<{ storefront: Storefront }>(
      `/api/storefronts/${storefront.id}`,
      { method: "PATCH", body: { isActive: !storefront.isActive } },
    );
    setStorefront({
      ...storefront,
      ...updated.storefront,
      shapes: updated.storefront.shapes ?? storefront.shapes,
      pricing: updated.storefront.pricing ?? storefront.pricing,
    });
  }

  async function handleDelete() {
    if (!storefront) return;
    await api(`/api/storefronts/${storefront.id}`, { method: "DELETE" });
    router.push("/dashboard/storefronts");
  }

  async function handleRemoveShape(shapeId: string) {
    if (!storefront) return;
    try {
      await api(`/api/storefronts/${storefront.id}/shapes/${shapeId}`, { method: "DELETE" });
      setStorefront({ ...storefront, shapes: storefront.shapes.filter((s) => s.id !== shapeId) });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove shape");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard API not available */
    }
  }

  function handlePricingUpdate(
    pricing: PricingRule[],
    meta?: { maxMagnetsPerOrder: number | null },
  ) {
    if (!storefront) return;
    setStorefront({
      ...storefront,
      pricing,
      ...(meta && { maxMagnetsPerOrder: meta.maxMagnetsPerOrder }),
    });
  }

  if (loading) {
    return <p className="text-sm text-[#6B7280]">Loading…</p>;
  }

  if (error || !storefront) {
    return (
      <div>
        <p className="text-sm text-[#DC2626]">{error || "Storefront not found"}</p>
        <Link href="/dashboard/storefronts" className="mt-2 inline-block text-sm text-[#2563EB]">
          Back to storefronts
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8">
      <div>
        <Link
          href="/dashboard/storefronts"
          className="-ml-1 inline-block rounded-md px-1 py-0.5 text-sm text-[#6B7280] transition-colors hover:bg-[#F9FAFB] hover:text-[#111111]"
        >
          &larr; All storefronts
        </Link>

        <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
            {storefront.name}
          </h1>
          <div className="mt-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                storefront.isOpen
                  ? "bg-green-50 text-[#16A34A]"
                  : "bg-gray-100 text-[#6B7280]"
              }`}
            >
              {storefront.isOpen ? "Open" : "Closed"}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleToggleActive}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F9FAFB]"
          >
            {storefront.isActive ? "Deactivate" : "Activate"}
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

      {(storefront.shapes.length === 0 || (storefront.pricing ?? []).length === 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800">Store is not ready yet</p>
          <ul className="mt-1 list-inside list-disc text-sm text-amber-700">
            {storefront.shapes.length === 0 && <li>Add at least one shape</li>}
            {(storefront.pricing ?? []).length === 0 && <li>Configure pricing</li>}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-[#FAFAFA] p-4">
        <h2 className="text-sm font-semibold text-[#111111]">Print branding</h2>
        <p className="mt-1 text-xs text-[#6B7280]">
          Shown on seller PDF print sheets. Max 40 characters. Empty uses
          default <span className="font-mono">@magnetooprints</span>.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-[#6B7280]">Brand line</span>
            <input
              type="text"
              value={brandDraft}
              onChange={(e) => setBrandDraft(e.target.value.slice(0, 40))}
              maxLength={40}
              placeholder="@magnetooprints"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#111111] outline-none ring-[#2563EB] focus:ring-2"
            />
          </label>
          <button
            type="button"
            disabled={brandSaving}
            onClick={() => void saveBrandText()}
            className="min-h-[44px] rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            {brandSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-[#FAFAFA] p-4">
        <h2 className="text-sm font-semibold text-[#111111]">Order notifications</h2>
        <p className="mt-1 text-xs text-[#6B7280]">
          When enabled, we email you at the address below each time a customer places an order.
        </p>
        <label className="mt-3 flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB]"
            checked={notifSendDraft}
            onChange={(e) => setNotifSendDraft(e.target.checked)}
          />
          <span className="text-sm text-[#111111]">Send new-order emails</span>
        </label>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-[#6B7280]">Notification email</span>
          <input
            type="email"
            value={notifEmailDraft}
            onChange={(e) => setNotifEmailDraft(e.target.value)}
            placeholder="seller@example.com"
            autoComplete="email"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#111111] outline-none ring-[#2563EB] focus:ring-2"
          />
        </label>
        <button
          type="button"
          disabled={notifSaving}
          onClick={() => void saveOrderNotifications()}
          className="mt-3 min-h-[40px] rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-50"
        >
          {notifSaving ? "Saving…" : "Save notifications"}
        </button>
      </div>

      {/* Store link */}
      <div className="rounded-lg border border-gray-200 bg-[#F9FAFB] px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">Store link</p>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={storeUrl}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#111111] focus:outline-none"
          />
          <button
            onClick={copyLink}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F9FAFB]"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* QR Code placeholder */}
      <div className="rounded-lg border border-gray-200 bg-[#F9FAFB] px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">QR Code</p>
        <div className="mt-3 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-6">
          <svg
            className="h-12 w-12 text-[#6B7280]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 14.625v2.25m0 3v.75m3-6v6m3-3.75v3.75m-6-6h6"
            />
          </svg>
          <p className="mt-3 text-sm font-medium text-[#111111]">Scan to order</p>
          <p className="mt-1 max-w-full truncate text-xs text-[#6B7280]">{storeUrl}</p>
        </div>
      </div>

      {/* Shapes */}
      <div>
        <h2 className="text-lg font-medium text-[#111111]">Shapes</h2>
        {storefront.shapes.length === 0 ? (
          <p className="mt-3 text-sm text-[#6B7280]">No shapes configured.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {storefront.shapes.map((shape) => (
              <li
                key={shape.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-sm"
              >
                <span className="text-[#111111]">
                  {shape.shapeType.charAt(0) + shape.shapeType.slice(1).toLowerCase()}{" "}
                  {shape.widthMm}×{shape.heightMm} mm
                </span>
                <button
                  onClick={() => handleRemoveShape(shape.id)}
                  type="button"
                  className="text-sm font-medium text-[#DC2626] transition-colors hover:bg-red-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <AddShapeForm
          onAdd={(shape) => setStorefront({ ...storefront, shapes: [...storefront.shapes, shape] })}
          apiBase={`/api/storefronts/${storefront.id}/shapes`}
        />
      </div>

      {/* Pricing */}
      <div>
        <h2 className="text-lg font-medium text-[#111111]">Pricing</h2>
        {(storefront.pricing ?? []).length === 0 ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Pricing not configured — customers cannot create orders until pricing is set.
          </p>
        ) : (
          <PricingPreview pricing={storefront.pricing ?? []} />
        )}
        <PricingEditor
          contextType="storefront"
          contextId={storefront.id}
          initialPricing={storefront.pricing ?? []}
          initialMaxMagnetsPerOrder={storefront.maxMagnetsPerOrder ?? null}
          onUpdate={handlePricingUpdate}
        />
      </div>
    </div>
  );
}

const SHAPE_PRESETS = [
  { label: "Square 50×50 mm", shapeType: "SQUARE", widthMm: 50, heightMm: 50 },
  { label: "Square 63×63 mm", shapeType: "SQUARE", widthMm: 63, heightMm: 63 },
  { label: "Circle 50×50 mm", shapeType: "CIRCLE", widthMm: 50, heightMm: 50 },
  { label: "Rectangle 50×70 mm", shapeType: "RECTANGLE", widthMm: 50, heightMm: 70 },
];

function AddShapeForm({
  onAdd,
  apiBase,
}: {
  onAdd: (shape: AllowedShape) => void;
  apiBase: string;
}) {
  const [selected, setSelected] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd() {
    if (!selected) return;
    const preset = SHAPE_PRESETS.find(
      (p) => `${p.shapeType}-${p.widthMm}-${p.heightMm}` === selected,
    );
    if (!preset) return;

    setAdding(true);
    setError("");
    try {
      const data = await api<{ shape: AllowedShape }>(apiBase, {
        method: "POST",
        body: { shapeType: preset.shapeType, widthMm: preset.widthMm, heightMm: preset.heightMm },
      });
      onAdd(data.shape);
      setSelected("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add shape");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="mt-4 flex items-end gap-3">
      <div className="flex-1">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-[#111111] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] focus:outline-none"
        >
          <option value="">Add a shape…</option>
          {SHAPE_PRESETS.map((p) => (
            <option key={`${p.shapeType}-${p.widthMm}-${p.heightMm}`} value={`${p.shapeType}-${p.widthMm}-${p.heightMm}`}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={handleAdd}
        disabled={!selected || adding}
        className="rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
      >
        {adding ? "Adding…" : "Add"}
      </button>
      {error && <p className="text-sm text-[#DC2626]">{error}</p>}
    </div>
  );
}
