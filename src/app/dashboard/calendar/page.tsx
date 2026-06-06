"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EventCalendar } from "@/components/dashboard/EventCalendar";
import type { CalendarEvent } from "@/lib/eventCalendar";
import { api } from "@/lib/api";
import {
  getCachedOrganizationUsage,
  getMe,
  subscribeOrganizationUsage,
} from "@/lib/auth";
import { usageHasFeature } from "@/lib/planFeatures";

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState(() => getCachedOrganizationUsage());

  useEffect(() => {
    void getMe().then(() => setUsage(getCachedOrganizationUsage()));
    return subscribeOrganizationUsage(() => {
      setUsage(getCachedOrganizationUsage());
    });
  }, []);

  const canCalendar = usageHasFeature(usage, "calendar");

  useEffect(() => {
    if (!canCalendar) {
      setLoading(false);
      return;
    }
    api<{ events: CalendarEvent[] }>("/api/events")
      .then((data) => setEvents(data.events))
      .finally(() => setLoading(false));
  }, [canCalendar]);

  if (!canCalendar) {
    return (
      <div className="dashboard-page mx-auto max-w-lg">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Calendar
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          The event calendar is available on the Hobby plan and above. Upgrade to
          see all your events on a timeline.
        </p>
        <Link
          href="/dashboard/billing"
          className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          View plans
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Calendar
      </h1>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <EventCalendar events={events} />
      )}
    </div>
  );
}
