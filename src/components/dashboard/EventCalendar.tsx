"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type CalendarEvent,
  type CalendarEventStatus,
  type WeekEventSegment,
  WEEKDAY_LABELS,
  addMonths,
  buildMonthWeeks,
  eventOverlapsMonth,
  getDayOverflowCount,
  getEventsForMonthDay,
  getMonthDays,
  isSameDay,
  layoutWeekEventSegments,
  MAX_VISIBLE_EVENT_ROWS,
} from "@/lib/eventCalendar";

const STATUS_DOT: Record<CalendarEventStatus, string> = {
  upcoming: "bg-primary",
  active: "bg-[#16A34A]",
  ended: "bg-muted-foreground",
  inactive: "bg-[#F59E0B]",
};

function formatTodayHeader(date: Date): string {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const rest = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `${weekday} | ${rest}`;
}

function formatMonthYear(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12.5 15 7.5 10l5-5" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m7.5 15 5-5-5-5" />
    </svg>
  );
}

function EventBar({
  name,
  status,
  onClick,
}: {
  name: string;
  status: CalendarEventStatus;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-5 w-full min-w-0 items-center gap-1.5 truncate rounded-md border border-border bg-background px-1.5 text-left text-xs text-foreground shadow-sm transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
      title={name}
    >
      <span
        className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT[status]}`}
        aria-hidden
      />
      <span className="truncate">{name}</span>
    </button>
  );
}

function segmentCoversDay(segment: WeekEventSegment, dayIndex: number): boolean {
  const col = dayIndex + 1;
  return col >= segment.colStart && col < segment.colStart + segment.colSpan;
}

function WeekRow({
  weekDays,
  month,
  today,
  monthEvents,
  onEventClick,
}: {
  weekDays: Date[];
  month: number;
  today: Date;
  monthEvents: CalendarEvent[];
  onEventClick: (id: string) => void;
}) {
  const { segments } = layoutWeekEventSegments(monthEvents, weekDays);

  return (
    <div className="grid grid-cols-7 border-b border-border last:border-b-0">
      {weekDays.map((day, dayIndex) => {
        const inMonth = day.getMonth() === month;
        const isToday = isSameDay(day, today);
        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
        const overflow = getDayOverflowCount(
          monthEvents,
          weekDays,
          dayIndex,
          segments,
        );

        const daySegments = segments.filter((segment) =>
          segmentCoversDay(segment, dayIndex),
        );
        const segmentsByRow = new Map(
          daySegments.map((segment) => [segment.row, segment]),
        );

        return (
          <div
            key={day.toISOString()}
            className={`relative flex min-h-[120px] flex-col border-r border-border p-2 last:border-r-0 ${
              inMonth ? "bg-background" : "bg-surface"
            }`}
          >
            {isToday ? (
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-white">
                {day.getDate()}
              </span>
            ) : (
              <span
                className={`inline-flex size-7 items-center justify-center text-xs font-medium ${
                  !inMonth
                    ? "text-muted-foreground"
                    : isWeekend
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-foreground"
                }`}
              >
                {day.getDate()}
              </span>
            )}

            <div
              className="mt-2 flex flex-col gap-0.5"
              style={{
                minHeight: `${MAX_VISIBLE_EVENT_ROWS * 24}px`,
              }}
            >
              {Array.from({ length: MAX_VISIBLE_EVENT_ROWS }, (_, row) => {
                const segment = segmentsByRow.get(row);
                if (!segment) {
                  return <div key={row} className="h-5" aria-hidden />;
                }

                return (
                  <EventBar
                    key={`${segment.eventId}-${row}`}
                    name={segment.name}
                    status={segment.status}
                    onClick={() => onEventClick(segment.eventId)}
                  />
                );
              })}
            </div>

            {overflow > 0 && (
              <p className="mt-auto pt-1 text-[10px] text-muted-foreground">
                +{overflow} more
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DesktopMonthGrid({
  events,
  year,
  month,
  today,
  onEventClick,
}: {
  events: CalendarEvent[];
  year: number;
  month: number;
  today: Date;
  onEventClick: (id: string) => void;
}) {
  const weeks = useMemo(() => buildMonthWeeks(year, month), [year, month]);
  const monthEvents = useMemo(
    () => events.filter((e) => eventOverlapsMonth(e, year, month)),
    [events, year, month],
  );

  return (
    <div className="hidden overflow-hidden rounded-lg border border-border lg:block">
      <div className="grid grid-cols-7 border-b border-border bg-surface">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      {weeks.map((weekDays) => (
        <WeekRow
          key={weekDays[0].toISOString()}
          weekDays={weekDays}
          month={month}
          today={today}
          monthEvents={monthEvents}
          onEventClick={onEventClick}
        />
      ))}
    </div>
  );
}

function MobileMonthList({
  events,
  year,
  month,
  today,
  onEventClick,
}: {
  events: CalendarEvent[];
  year: number;
  month: number;
  today: Date;
  onEventClick: (id: string) => void;
}) {
  const days = useMemo(() => getMonthDays(year, month), [year, month]);
  const monthEvents = useMemo(
    () => events.filter((e) => eventOverlapsMonth(e, year, month)),
    [events, year, month],
  );

  const daysWithEvents = days
    .map((day) => ({
      day,
      events: getEventsForMonthDay(monthEvents, day),
    }))
    .filter((entry) => entry.events.length > 0);

  if (daysWithEvents.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-background px-4 py-8 text-center lg:hidden">
        <p className="text-sm text-muted-foreground">No events this month.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 lg:hidden">
      {daysWithEvents.map(({ day, events: dayEvents }) => {
        const isToday = isSameDay(day, today);
        return (
          <div
            key={day.toISOString()}
            className="overflow-hidden rounded-lg border border-border bg-background"
          >
            <div
              className={`border-b border-border px-4 py-2 text-sm font-medium ${
                isToday ? "bg-primary text-white" : "bg-surface text-foreground"
              }`}
            >
              {day.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </div>
            <ul className="divide-y divide-border">
              {dayEvents.map((event) => (
                <li key={`${event.id}-${day.toISOString()}`}>
                  <button
                    type="button"
                    onClick={() => onEventClick(event.id)}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  >
                    <span
                      className={`size-2 shrink-0 rounded-full ${STATUS_DOT[event.status]}`}
                      aria-hidden
                    />
                    <span className="font-medium text-foreground">{event.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export type EventCalendarProps = {
  events: CalendarEvent[];
};

export function EventCalendar({ events }: EventCalendarProps) {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();

  function goToToday() {
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  function goToPreviousMonth() {
    setVisibleMonth((current) => addMonths(current, -1));
  }

  function goToNextMonth() {
    setVisibleMonth((current) => addMonths(current, 1));
  }

  function handleEventClick(eventId: string) {
    router.push(`/dashboard/events/${eventId}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-lg font-medium text-foreground">
          {formatTodayHeader(today)}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goToPreviousMonth}
              aria-label="Previous month"
              className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ChevronLeftIcon className="size-5" />
            </button>
            <span className="min-w-[140px] text-center text-sm font-medium text-foreground">
              {formatMonthYear(year, month)}
            </span>
            <button
              type="button"
              onClick={goToNextMonth}
              aria-label="Next month"
              className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ChevronRightIcon className="size-5" />
            </button>
          </div>
          <button
            type="button"
            onClick={goToToday}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Today
          </button>
        </div>
      </div>

      <DesktopMonthGrid
        events={events}
        year={year}
        month={month}
        today={today}
        onEventClick={handleEventClick}
      />
      <MobileMonthList
        events={events}
        year={year}
        month={month}
        today={today}
        onEventClick={handleEventClick}
      />
    </div>
  );
}
