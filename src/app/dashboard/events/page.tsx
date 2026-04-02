"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type Event = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isOpen: boolean;
  status: "upcoming" | "active" | "ended" | "inactive";
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
  inactive: {
    label: "Inactive",
    className: "bg-amber-50 text-[#B45309]",
  },
};

export default function EventsPage() {
  const router = useRouter();
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
    <div className="flex flex-col gap-8">
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
        <p className="text-sm text-[#6B7280]">Loading…</p>
      ) : events.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-[#6B7280]">No events yet.</p>
          <p className="mt-1 text-sm text-[#6B7280]">
            Create your first event to start accepting orders.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
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
              {events
                .filter((event) => event.id)
                .map((event) => {
                  const href = `/dashboard/events/${event.id}`;
                  return (
                    <tr
                      key={event.id}
                      role="link"
                      tabIndex={0}
                      aria-label={`Open event ${event.name}`}
                      className="cursor-pointer hover:bg-[#F9FAFB] focus-visible:bg-[#F9FAFB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
                      onClick={() => router.push(href)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(href);
                        }
                      }}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-[#111111]">{event.name}</span>
                      </td>
                      <td className="px-4 py-3 text-[#6B7280]">
                        {formatDate(event.startDate)}
                      </td>
                      <td className="px-4 py-3 text-[#6B7280]">
                        {formatDate(event.endDate)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[event.status].className}`}
                        >
                          {STATUS_BADGE[event.status].label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
