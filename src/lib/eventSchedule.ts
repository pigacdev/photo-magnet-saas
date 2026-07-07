export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function validateNewEventSchedule(
  start: Date,
  end: Date,
  now: Date = new Date(),
): { ok: true } | { ok: false; error: string } {
  if (start >= end) {
    return { ok: false, error: "Start date must be before end date" };
  }
  if (end <= now) {
    return { ok: false, error: "End date must be in the future" };
  }
  return { ok: true };
}
