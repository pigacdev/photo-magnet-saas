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

type Event = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isOpen: boolean;
  status: "upcoming" | "active" | "ended";
  shapes: AllowedShape[];
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

    await api(`/api/events/${event.id}/shapes/${shapeId}`, {
      method: "DELETE",
    });

    setEvent({
      ...event,
      shapes: event.shapes.filter((s) => s.id !== shapeId),
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
    <div className="mx-auto max-w-lg">
      <Link
        href="/dashboard/events"
        className="text-sm text-[#6B7280] hover:text-[#111111]"
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

      <dl className="mt-6 space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-[#6B7280]">Start</dt>
          <dd className="text-[#111111]">{formatDate(event.startDate)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[#6B7280]">End</dt>
          <dd className="text-[#111111]">{formatDate(event.endDate)}</dd>
        </div>
      </dl>

      <div className="mt-8">
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
                  onClick={() => handleRemoveShape(shape.id)}
                  className="text-[#6B7280] transition-colors hover:text-[#DC2626]"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
