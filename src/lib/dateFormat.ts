export const DATE_FORMATS = ["DMY", "MDY", "YMD"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export const DEFAULT_DATE_FORMAT: DateFormat = "DMY";

export const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string }[] = [
  { value: "DMY", label: "DD/MM/YYYY" },
  { value: "MDY", label: "MM/DD/YYYY" },
  { value: "YMD", label: "YYYY-MM-DD" },
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function dateParts(d: Date): { y: number; m: number; day: number } {
  return {
    y: d.getFullYear(),
    m: d.getMonth() + 1,
    day: d.getDate(),
  };
}

export function formatDisplayDate(
  value: string | Date,
  format: DateFormat = DEFAULT_DATE_FORMAT,
): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const { y, m, day } = dateParts(d);
  if (format === "DMY") return `${pad2(day)}/${pad2(m)}/${y}`;
  if (format === "MDY") return `${pad2(m)}/${pad2(day)}/${y}`;
  return `${y}-${pad2(m)}-${pad2(day)}`;
}

export function formatDisplayDateTime(
  value: string | Date,
  format: DateFormat = DEFAULT_DATE_FORMAT,
): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const date = formatDisplayDate(d, format);
  const hours = pad2(d.getHours());
  const minutes = pad2(d.getMinutes());
  return `${date}, ${hours}:${minutes}`;
}

/** Short month label for charts/calendar, respecting date order preset. */
export function formatDisplayMonthDay(
  value: string | Date,
  format: DateFormat = DEFAULT_DATE_FORMAT,
): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const { m, day, y } = dateParts(d);
  if (format === "MDY") return `${month} ${day}`;
  if (format === "YMD") return `${y}-${pad2(m)}-${pad2(day)}`;
  return `${day} ${month}`;
}

export function getDateFormatLabel(format: DateFormat): string {
  return DATE_FORMAT_OPTIONS.find((o) => o.value === format)?.label ?? format;
}
