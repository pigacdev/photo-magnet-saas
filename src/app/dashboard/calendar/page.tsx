"use client";

import { useEffect, useState } from "react";
import { EventCalendar } from "@/components/dashboard/EventCalendar";
import type { CalendarEvent } from "@/lib/eventCalendar";
import { api } from "@/lib/api";

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ events: CalendarEvent[] }>("/api/events")
      .then((data) => setEvents(data.events))
      .finally(() => setLoading(false));
  }, []);

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
