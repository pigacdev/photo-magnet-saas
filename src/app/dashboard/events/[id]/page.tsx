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

type Event = {
  id: string;
  name: string;
  brandText: string | null;
  notificationEmail: string | null;
  sendOrderEmails: boolean;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isOpen: boolean;
  status: "upcoming" | "active" | "ended" | "inactive";
  maxMagnetsPerOrder: number | null;
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
  inactive: {
    label: "Inactive",
    className: "bg-amber-50 text-[#B45309]",
  },
};

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [brandDraft, setBrandDraft] = useState("");
  const [brandSaving, setBrandSaving] = useState(false);
  const [notifEmailDraft, setNotifEmailDraft] = useState("");
  const [notifSendDraft, setNotifSendDraft] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);

  useEffect(() => {
    api<{ event: Event }>(`/api/events/${params.id}`)
      .then((data) => {
        setEvent(data.event);
        setBrandDraft(data.event.brandText ?? "");
        setNotifEmailDraft(data.event.notificationEmail ?? "");
        setNotifSendDraft(data.event.sendOrderEmails ?? false);
      })
      .catch(() => setError("Event not found"))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function saveOrderNotifications() {
    if (!event) return;
    setNotifSaving(true);
    try {
      const updated = await api<{ event: Event }>(`/api/events/${event.id}`, {
        method: "PATCH",
        body: {
          sendOrderEmails: notifSendDraft,
          notificationEmail:
            notifEmailDraft.trim() === "" ? null : notifEmailDraft.trim(),
        },
      });
      setEvent({
        ...event,
        ...updated.event,
        shapes: updated.event.shapes ?? event.shapes,
        pricing: updated.event.pricing ?? event.pricing,
      });
      setNotifEmailDraft(updated.event.notificationEmail ?? "");
      setNotifSendDraft(updated.event.sendOrderEmails ?? false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not save");
    } finally {
      setNotifSaving(false);
    }
  }

  async function saveBrandText() {
    if (!event) return;
    setBrandSaving(true);
    try {
      const updated = await api<{ event: Event }>(`/api/events/${event.id}`, {
        method: "PATCH",
        body: {
          brandText: brandDraft.trim() === "" ? null : brandDraft.trim(),
        },
      });
      setEvent({
        ...event,
        ...updated.event,
        shapes: updated.event.shapes ?? event.shapes,
        pricing: updated.event.pricing ?? event.pricing,
      });
      setBrandDraft(updated.event.brandText ?? "");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBrandSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!event) return;
    const updated = await api<{ event: Event }>(`/api/events/${event.id}`, {
      method: "PATCH",
      body: { isActive: !event.isActive },
    });
    setEvent({
      ...event,
      ...updated.event,
      shapes: updated.event.shapes ?? event.shapes,
      pricing: updated.event.pricing ?? event.pricing,
    });
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

  function handlePricingUpdate(
    pricing: PricingRule[],
    meta?: { maxMagnetsPerOrder: number | null },
  ) {
    if (!event) return;
    setEvent({
      ...event,
      pricing,
      ...(meta && { maxMagnetsPerOrder: meta.maxMagnetsPerOrder }),
    });
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
            type="button"
            onClick={handleToggleActive}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F9FAFB]"
          >
            {event.isActive ? "Deactivate" : "Activate"}
          </button>
          <button
            type="button"
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
        {(event.pricing ?? []).length === 0 ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Pricing not configured — customers cannot create orders until pricing is set.
          </p>
        ) : (
          <PricingPreview pricing={event.pricing ?? []} />
        )}
        <PricingEditor
          contextType="event"
          contextId={event.id}
          initialPricing={event.pricing ?? []}
          initialMaxMagnetsPerOrder={event.maxMagnetsPerOrder ?? null}
          onUpdate={handlePricingUpdate}
        />
      </div>
    </div>
  );
}
