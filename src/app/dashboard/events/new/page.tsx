"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  getCachedOrganizationUsage,
  getMe,
  invalidateAuthCache,
  subscribeOrganizationUsage,
} from "@/lib/auth";
import { hasUnlimitedEvents } from "@/lib/planCatalog";
import { getEventUsageLevel } from "@/lib/planUsage";
import { EventLimitReachedNotice } from "@/components/dashboard/DashboardCenteredNotice";

export default function NewEventPage() {
  const router = useRouter();
  const [usage, setUsage] = useState(() => getCachedOrganizationUsage());
  const [usageLoaded, setUsageLoaded] = useState(() => usage != null);

  useEffect(() => {
    void getMe().then(() => {
      setUsage(getCachedOrganizationUsage());
      setUsageLoaded(true);
    });
    return subscribeOrganizationUsage(() => {
      setUsage(getCachedOrganizationUsage());
      setUsageLoaded(true);
    });
  }, []);

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const eventLimitReached =
    usage != null && getEventUsageLevel(usage) === "reached";

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

    setLoading(true);

    try {
      const created = await api<{ event: { id: string } }>("/api/events", {
        method: "POST",
        body: {
          name: name.trim(),
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
        },
      });
      invalidateAuthCache();
      await getMe();
      router.push(`/dashboard/events/${created.event.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setLoading(false);
    }
  }

  if (usageLoaded && eventLimitReached && usage) {
    return (
      <EventLimitReachedNotice
        eventsCreated={usage.eventsCreatedThisMonth ?? 0}
        eventLimit={usage.eventLimit ?? 1}
        showBackLink
      />
    );
  }

  return (
    <div className="dashboard-page mx-auto max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Create event
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set the name and schedule first. You will configure shapes, pricing, and
          other settings on the next screen.
        </p>
        {usage && !hasUnlimitedEvents(usage.eventLimit) ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Events created this month:{" "}
            <span className="font-medium tabular-nums text-foreground">
              {usage.eventsCreatedThisMonth ?? 0} / {usage.eventLimit ?? 1}
            </span>
            .{" "}
            <Link href="/dashboard/billing" className="text-primary hover:underline">
              Upgrade
            </Link>{" "}
            for more.
          </p>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground">
            Event name
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            placeholder="e.g. Smith Wedding"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-foreground">
              Start date
            </label>
            <input
              id="startDate"
              type="datetime-local"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-border px-3 py-2.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-foreground">
              End date
            </label>
            <input
              id="endDate"
              type="datetime-local"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-border px-3 py-2.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>
        </div>

        {error && <p className="text-sm text-[#DC2626]">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create event"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/events")}
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
