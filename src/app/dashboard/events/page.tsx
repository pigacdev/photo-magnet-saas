"use client";

import {
  Fragment,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import {
  getCachedOrganizationUsage,
  getMe,
  subscribeOrganizationUsage,
} from "@/lib/auth";
import { formatDisplayDate } from "@/lib/dateFormat";
import { getEventUsageLevel, getPlanUsageLevel } from "@/lib/planUsage";
import { EventLimitReachedNotice } from "@/components/dashboard/DashboardCenteredNotice";
import { CustomerLinkQrCompact } from "@/components/dashboard/CustomerLinkQrCompact";
import { useCopyLink } from "@/hooks/useCopyLink";
import {
  EVENT_STATUS_FILTER_OPTIONS,
  eventStatusFilterSelectionLabels,
  isEventStatusFilterChecked,
  toggleEventStatusFilter,
} from "@/lib/eventDisplayStatus";

type Event = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isOpen: boolean;
  configurationComplete: boolean;
  status: "upcoming" | "active" | "ended" | "inactive";
  createdAt: string;
};

type EventsListResponse = {
  items: Event[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
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

function startOfTodayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfTodayLocal(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeekMondayLocal(from: Date): Date {
  const d = new Date(from);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeekSundayLocal(from: Date): Date {
  const mon = startOfWeekMondayLocal(from);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return sun;
}

function startOfMonthLocal(from: Date): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonthLocal(from: Date): Date {
  const d = new Date(from.getFullYear(), from.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function datesMatchPreset(
  urlFrom: string | null,
  urlTo: string | null,
  start: Date,
  end: Date,
): boolean {
  if (!urlFrom || !urlTo) return false;
  return urlFrom === start.toISOString() && urlTo === end.toISOString();
}

function startOfLocalDayFromYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(y, mo, day, 0, 0, 0, 0);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== day) {
    return null;
  }
  return d;
}

function endOfLocalDayFromYmd(ymd: string): Date | null {
  const s = startOfLocalDayFromYmd(ymd);
  if (!s) return null;
  const e = new Date(s);
  e.setHours(23, 59, 59, 999);
  return e;
}

function isoToDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function publicEntryUrl(origin: string, eventId: string): string {
  return origin ? `${origin}/event/${eventId}` : "";
}

function EventRowCopyLink({
  publicUrl,
  eventName,
  disabled,
}: {
  publicUrl: string;
  eventName: string;
  disabled: boolean;
}) {
  const { copy, copied, canCopy } = useCopyLink(publicUrl);

  if (!canCopy || disabled) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <button
      type="button"
      aria-label={`Copy customer event order link for ${eventName}`}
      onClick={(e) => {
        e.stopPropagation();
        void copy();
      }}
      className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 transition-colors hover:bg-green-100 dark:border-green-900 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-950/60"
    >
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}

function EventsListContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [events, setEvents] = useState<Event[]>([]);
  const [pagination, setPagination] = useState<EventsListResponse["pagination"]>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState(() => getCachedOrganizationUsage());
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [origin, setOrigin] = useState("");

  const searchFromUrl = searchParams.get("search") ?? "";
  const [searchDraft, setSearchDraft] = useState(searchFromUrl);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detailsRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    void getMe().then(() => setUsage(getCachedOrganizationUsage()));
    return subscribeOrganizationUsage(() => {
      setUsage(getCachedOrganizationUsage());
    });
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const toggleExpanded = useCallback((eventId: string) => {
    setExpandedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }, []);

  const monthlyLimitReached =
    usage != null && getPlanUsageLevel(usage) === "reached";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!detailsRef.current) return;
      if (!detailsRef.current.contains(event.target as Node)) {
        detailsRef.current.removeAttribute("open");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setSearchDraft(searchFromUrl);
  }, [searchFromUrl]);

  const replaceQuery = useCallback(
    (mutate: (q: URLSearchParams) => void) => {
      const q = new URLSearchParams(searchParams.toString());
      mutate(q);
      const s = q.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const datePresetActive = useMemo(() => {
    const now = new Date();
    const df = searchParams.get("dateFrom");
    const dt = searchParams.get("dateTo");
    return {
      today: datesMatchPreset(df, dt, startOfTodayLocal(), endOfTodayLocal()),
      week: datesMatchPreset(
        df,
        dt,
        startOfWeekMondayLocal(now),
        endOfWeekSundayLocal(now),
      ),
      month: datesMatchPreset(
        df,
        dt,
        startOfMonthLocal(now),
        endOfMonthLocal(now),
      ),
    };
  }, [searchParams]);

  function applyDatePreset(preset: "today" | "week" | "month") {
    const now = new Date();
    let start: Date;
    let end: Date;
    if (preset === "today") {
      start = startOfTodayLocal();
      end = endOfTodayLocal();
    } else if (preset === "week") {
      start = startOfWeekMondayLocal(now);
      end = endOfWeekSundayLocal(now);
    } else {
      start = startOfMonthLocal(now);
      end = endOfMonthLocal(now);
    }
    replaceQuery((q) => {
      q.set("dateFrom", start.toISOString());
      q.set("dateTo", end.toISOString());
      q.delete("dateRange");
      q.set("page", "1");
    });
  }

  function clearDateFilters() {
    replaceQuery((q) => {
      q.delete("dateFrom");
      q.delete("dateTo");
      q.delete("dateRange");
      q.set("page", "1");
    });
  }

  function clearAllFilters() {
    replaceQuery((q) => {
      q.delete("search");
      q.delete("status");
      q.delete("dateFrom");
      q.delete("dateTo");
      q.delete("dateRange");
      q.set("page", "1");
    });
    setSearchDraft("");
  }

  const fromDateValue = isoToDateInputValue(searchParams.get("dateFrom"));
  const toDateValue = isoToDateInputValue(searchParams.get("dateTo"));

  function updateDateFilter(which: "from" | "to", ymd: string) {
    replaceQuery((q) => {
      q.delete("dateRange");
      q.set("page", "1");

      if (which === "from") {
        if (!ymd) {
          q.delete("dateFrom");
          q.delete("dateTo");
          return;
        }
        const start = startOfLocalDayFromYmd(ymd);
        if (!start) return;
        q.set("dateFrom", start.toISOString());

        const hadTo = Boolean(searchParams.get("dateTo"));
        if (!hadTo) {
          const end = endOfLocalDayFromYmd(ymd);
          if (end) q.set("dateTo", end.toISOString());
        }
        return;
      }

      if (!ymd) {
        q.delete("dateTo");
        return;
      }
      const end = endOfLocalDayFromYmd(ymd);
      if (end) q.set("dateTo", end.toISOString());
    });
  }

  useEffect(() => {
    if (searchDraft === searchFromUrl) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      searchDebounceRef.current = null;
      replaceQuery((q) => {
        const t = searchDraft.trim();
        if (t) q.set("search", t);
        else q.delete("search");
        q.set("page", "1");
      });
    }, 400);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchDraft, searchFromUrl, replaceQuery]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const qs = searchParams.toString();
    const url = qs ? `/api/events?${qs}` : "/api/events";
    api<EventsListResponse>(url)
      .then((data) => {
        setEvents(data.items);
        setPagination(data.pagination);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [searchParams]);

  const eventLimitReached =
    usage != null && getEventUsageLevel(usage) === "reached";

  const hasFilters =
    Boolean(searchParams.get("search")?.trim()) ||
    Boolean(searchParams.get("status")?.trim()) ||
    Boolean(searchParams.get("dateFrom")) ||
    Boolean(searchParams.get("dateTo"));

  const hasDateInUrl =
    Boolean(searchParams.get("dateFrom")) ||
    Boolean(searchParams.get("dateTo"));

  const statusParam = searchParams.get("status");
  const statusFilterLabels = useMemo(
    () => eventStatusFilterSelectionLabels(statusParam),
    [statusParam],
  );

  const page = pagination.page;
  const totalPages = pagination.totalPages;
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const quickBtn =
    "inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium transition-colors";
  const quickBtnIdle = `${quickBtn} border-border bg-background text-foreground hover:bg-surface`;
  const quickBtnActive = `${quickBtn} border-primary bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300`;

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

      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Date</span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => applyDatePreset("today")}
              className={datePresetActive.today ? quickBtnActive : quickBtnIdle}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset("week")}
              className={datePresetActive.week ? quickBtnActive : quickBtnIdle}
            >
              This week
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset("month")}
              className={datePresetActive.month ? quickBtnActive : quickBtnIdle}
            >
              This month
            </button>
            <button
              type="button"
              onClick={() => clearDateFilters()}
              disabled={!hasDateInUrl}
              className={`${quickBtn} border-border bg-background text-foreground hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40`}
            >
              Clear
            </button>
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">From</span>
          <input
            type="date"
            value={fromDateValue}
            onChange={(e) => updateDateFilter("from", e.target.value)}
            className="min-h-11 w-[140px] rounded-lg border border-border px-2 text-sm text-foreground outline-none ring-primary focus:ring-2"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">To</span>
          <input
            type="date"
            value={toDateValue}
            onChange={(e) => updateDateFilter("to", e.target.value)}
            className="min-h-11 w-[140px] rounded-lg border border-border px-2 text-sm text-foreground outline-none ring-primary focus:ring-2"
          />
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Search</span>
          <input
            type="search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search by event name"
            className="rounded-lg border border-border px-3 py-2 text-sm text-foreground outline-none ring-primary focus:ring-2"
          />
        </label>
        <div className="relative flex w-full min-w-[200px] flex-col gap-1.5 sm:w-56">
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          <details ref={detailsRef} className="group relative">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-primary marker:hidden focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 truncate">
                <span className="font-medium text-muted-foreground">Showing:</span>{" "}
                {statusFilterLabels.length === 0
                  ? "All"
                  : statusFilterLabels.join(", ")}
              </span>
              <span
                className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden
              >
                ▾
              </span>
            </summary>
            <div className="absolute left-0 right-0 z-20 mt-1 rounded-lg border border-border bg-background py-2 shadow-lg">
              <div className="border-b border-border px-3 pb-2">
                <button
                  type="button"
                  className="text-sm font-medium text-primary hover:underline"
                  onClick={() => {
                    replaceQuery((q) => {
                      q.delete("status");
                      q.set("page", "1");
                    });
                  }}
                >
                  All statuses
                </button>
              </div>
              <ul className="max-h-64 overflow-auto px-2 pt-2 pb-2">
                {EVENT_STATUS_FILTER_OPTIONS.map((opt) => {
                  const checked = isEventStatusFilterChecked(
                    opt.value,
                    statusParam,
                  );
                  return (
                    <li key={opt.value}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground hover:bg-surface">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const param = toggleEventStatusFilter(
                              opt.value,
                              statusParam,
                            );
                            replaceQuery((q) => {
                              if (param) q.set("status", param);
                              else q.delete("status");
                              q.set("page", "1");
                            });
                          }}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                        {opt.label}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          </details>
        </div>
        <label className="flex w-full min-w-[120px] flex-col gap-1.5 sm:w-32">
          <span className="text-xs font-medium text-muted-foreground">Page size</span>
          <select
            value={searchParams.get("pageSize") ?? String(pagination.pageSize)}
            onChange={(e) => {
              const pageSize = e.target.value;
              replaceQuery((q) => {
                q.set("pageSize", pageSize);
                q.set("page", "1");
              });
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-primary focus:ring-2"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </label>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : events.length === 0 ? (
        hasFilters ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No events match your filters.</p>
            <button
              type="button"
              onClick={clearAllFilters}
              className="mt-3 text-sm font-medium text-primary hover:underline"
            >
              Clear all filters
            </button>
          </div>
        ) : eventLimitReached ? null : (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No events yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first event to start accepting orders.
            </p>
          </div>
        )
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface">
                <tr>
                  <th className="w-10 px-2 py-3">
                    <span className="sr-only">Expand</span>
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Start</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">End</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Link
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events
                  .filter((event) => event.id)
                  .map((event) => {
                    const href = `/dashboard/events/${event.id}`;
                    const expanded = expandedEventIds.has(event.id);
                    const ordersReady =
                      event.configurationComplete === true &&
                      event.isOpen === true;
                    const entryUrl = publicEntryUrl(origin, event.id);

                    return (
                      <Fragment key={event.id}>
                        <tr
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
                          <td
                            className="w-10 px-2 py-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              aria-expanded={expanded}
                              aria-controls={`event-qr-${event.id}`}
                              aria-label={`Show QR code for ${event.name}`}
                              onClick={() => toggleExpanded(event.id)}
                              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              <span
                                className={`inline-block transition-transform ${expanded ? "rotate-90" : ""}`}
                                aria-hidden
                              >
                                ▸
                              </span>
                            </button>
                          </td>
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
                            {formatDisplayDate(event.startDate, usage?.dateFormat)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDisplayDate(event.endDate, usage?.dateFormat)}
                          </td>
                          <td
                            className="px-4 py-3 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <EventRowCopyLink
                              publicUrl={entryUrl}
                              eventName={event.name}
                              disabled={!ordersReady || monthlyLimitReached}
                            />
                          </td>
                        </tr>
                        {expanded ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-3">
                              <div
                                id={`event-qr-${event.id}`}
                                className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900 dark:bg-green-950/20"
                              >
                                {ordersReady ? (
                                  <CustomerLinkQrCompact
                                    publicUrl={entryUrl}
                                    variant="event"
                                    entityName={event.name}
                                    entityId={event.id}
                                    monthlyLimitReached={monthlyLimitReached}
                                  />
                                ) : (
                                  <p className="text-sm text-green-800/90 dark:text-green-300/90">
                                    Complete event setup and open the event to get
                                    your customer QR code.{" "}
                                    <Link
                                      href={href}
                                      className="font-medium text-green-800 underline dark:text-green-300"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      Open event
                                    </Link>
                                  </p>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({pagination.total} events)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!canPrev}
                onClick={() =>
                  replaceQuery((q) => {
                    q.set("page", String(Math.max(1, page - 1)));
                  })
                }
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!canNext}
                onClick={() =>
                  replaceQuery((q) => {
                    q.set("page", String(Math.min(totalPages, page + 1)));
                  })
                }
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Events
          </h1>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <EventsListContent />
    </Suspense>
  );
}
