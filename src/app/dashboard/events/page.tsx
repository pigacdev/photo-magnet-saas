"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Event = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isOpen: boolean;
  status: "upcoming" | "active" | "ended";
  createdAt: string;
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

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ events: Event[] }>("/api/events")
      .then((data) => setEvents(data.events))
      .finally(() => setLoading(false));
  }, []);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
          Events
        </h1>
        <Link
          href="/dashboard/events/new"
          className="rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8]"
        >
          Create event
        </Link>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-[#6B7280]">Loading…</p>
      ) : events.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-[#6B7280]">No events yet.</p>
          <p className="mt-1 text-sm text-[#6B7280]">
            Create your first event to start accepting orders.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-[#F9FAFB]">
              <tr>
                <th className="px-4 py-3 font-medium text-[#6B7280]">Name</th>
                <th className="px-4 py-3 font-medium text-[#6B7280]">Start</th>
                <th className="px-4 py-3 font-medium text-[#6B7280]">End</th>
                <th className="px-4 py-3 font-medium text-[#6B7280]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-[#F9FAFB]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/events/${event.id}`}
                      className="font-medium text-[#111111] hover:text-[#2563EB]"
                    >
                      {event.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#6B7280]">
                    {formatDate(event.startDate)}
                  </td>
                  <td className="px-4 py-3 text-[#6B7280]">
                    {formatDate(event.endDate)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[event.status].className}`}>
                      {STATUS_BADGE[event.status].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
