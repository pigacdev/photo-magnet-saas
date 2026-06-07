"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  getCachedOrganizationUsage,
  getMe,
  subscribeOrganizationUsage,
} from "@/lib/auth";
import { getEventUsageLevel } from "@/lib/planUsage";
import { EventLimitReachedNotice } from "@/components/dashboard/DashboardCenteredNotice";

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
    className: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  },
  active: {
    label: "Active",
    className: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  },
  ended: {
    label: "Ended",
    className: "bg-surface text-muted-foreground",
  },
  inactive: {
    label: "Inactive",
    className: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  },
};

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState(() => getCachedOrganizationUsage());

  useEffect(() => {
    api<{ events: Event[] }>("/api/events")
      .then((data) => setEvents(data.events))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void getMe().then(() => setUsage(getCachedOrganizationUsage()));
    return subscribeOrganizationUsage(() => {
      setUsage(getCachedOrganizationUsage());
    });
  }, []);

  const eventLimitReached =
    usage != null && getEventUsageLevel(usage) === "reached";

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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Events
        </h1>
        {!eventLimitReached ? (
          <Link
            href="/dashboard/events/new"
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8]"
          >
            Create event
          </Link>
        ) : null}
      </div>

      {eventLimitReached && usage ? (
        <EventLimitReachedNotice
          eventsCreated={usage.eventsCreatedThisMonth ?? 0}
          eventLimit={usage.eventLimit ?? 1}
          fillHeight={false}
        />
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : events.length === 0 ? (
        eventLimitReached ? null : (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No events yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first event to start accepting orders.
            </p>
          </div>
        )
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface">
              <tr>
                <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Start</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
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
                      className="cursor-pointer hover:bg-surface focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      onClick={() => router.push(href)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(href);
                        }
                      }}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{event.name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[event.status].className}`}
                        >
                          {STATUS_BADGE[event.status].label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(event.startDate)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(event.endDate)}
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
