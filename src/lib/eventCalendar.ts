export type CalendarEventStatus = "upcoming" | "active" | "ended" | "inactive";

export type CalendarEvent = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: CalendarEventStatus;
};

export type WeekEventSegment = {
  eventId: string;
  name: string;
  status: CalendarEventStatus;
  colStart: number;
  colSpan: number;
  row: number;
};

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const MAX_VISIBLE_EVENT_ROWS = 3;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function buildMonthWeeks(year: number, month: number): Date[][] {
  const weeks: Date[][] = [];
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  const cursor = new Date(firstOfMonth);
  cursor.setDate(cursor.getDate() - ((firstOfMonth.getDay() + 6) % 7));

  while (true) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    if (week[6] >= lastOfMonth) break;
  }

  return weeks;
}

export function eventOverlapsMonth(
  event: CalendarEvent,
  year: number,
  month: number,
): boolean {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  return start <= monthEnd && end >= monthStart;
}

export function eventTouchesDay(event: CalendarEvent, day: Date): boolean {
  const dayStart = startOfDay(day);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  return start <= dayEnd && end >= dayStart;
}

export function layoutWeekEventSegments(
  events: CalendarEvent[],
  weekDays: Date[],
): { segments: WeekEventSegment[]; hiddenCount: number } {
  const weekStart = startOfDay(weekDays[0]);
  const weekEnd = startOfDay(weekDays[6]);

  type RawSegment = {
    eventId: string;
    name: string;
    status: CalendarEventStatus;
    colStart: number;
    colSpan: number;
    sortKey: number;
  };

  const raw: RawSegment[] = [];

  for (const event of events) {
    const eventStart = startOfDay(new Date(event.startDate));
    const eventEnd = startOfDay(new Date(event.endDate));

    if (eventEnd < weekStart || eventStart > weekEnd) continue;

    const clipStart = eventStart < weekStart ? weekStart : eventStart;
    const clipEnd = eventEnd > weekEnd ? weekEnd : eventEnd;

    let colStart = -1;
    let colEnd = -1;
    for (let i = 0; i < 7; i++) {
      const day = startOfDay(weekDays[i]);
      if (day >= clipStart && day <= clipEnd) {
        if (colStart === -1) colStart = i + 1;
        colEnd = i + 1;
      }
    }

    if (colStart === -1) continue;

    raw.push({
      eventId: event.id,
      name: event.name,
      status: event.status,
      colStart,
      colSpan: colEnd - colStart + 1,
      sortKey: new Date(event.startDate).getTime(),
    });
  }

  raw.sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name));

  const rowOccupancy: boolean[][] = [];
  const segments: WeekEventSegment[] = [];
  let hiddenCount = 0;

  for (const seg of raw) {
    let assignedRow = -1;
    for (let r = 0; r < MAX_VISIBLE_EVENT_ROWS; r++) {
      if (!rowOccupancy[r]) rowOccupancy[r] = Array(7).fill(false);
      let fits = true;
      for (let c = seg.colStart - 1; c < seg.colStart - 1 + seg.colSpan; c++) {
        if (rowOccupancy[r][c]) {
          fits = false;
          break;
        }
      }
      if (fits) {
        assignedRow = r;
        for (let c = seg.colStart - 1; c < seg.colStart - 1 + seg.colSpan; c++) {
          rowOccupancy[r][c] = true;
        }
        break;
      }
    }

    if (assignedRow === -1) {
      hiddenCount++;
      continue;
    }

    segments.push({
      eventId: seg.eventId,
      name: seg.name,
      status: seg.status,
      colStart: seg.colStart,
      colSpan: seg.colSpan,
      row: assignedRow,
    });
  }

  return { segments, hiddenCount };
}

export function getDayOverflowCount(
  events: CalendarEvent[],
  weekDays: Date[],
  dayIndex: number,
  visibleSegments: WeekEventSegment[],
): number {
  const day = weekDays[dayIndex];
  const touching = events.filter((e) => eventTouchesDay(e, day));
  const visibleIds = new Set(
    visibleSegments
      .filter(
        (s) =>
          dayIndex + 1 >= s.colStart &&
          dayIndex + 1 < s.colStart + s.colSpan,
      )
      .map((s) => s.eventId),
  );
  return Math.max(0, touching.length - visibleIds.size);
}

export function getEventsForMonthDay(
  events: CalendarEvent[],
  day: Date,
): CalendarEvent[] {
  return events
    .filter((e) => eventTouchesDay(e, day))
    .sort(
      (a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime() ||
        a.name.localeCompare(b.name),
    );
}

export function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const last = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= last; d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}
