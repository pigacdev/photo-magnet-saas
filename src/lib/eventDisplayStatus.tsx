export type EventWorkflowStatus = "upcoming" | "active" | "ended" | "inactive";

export const EVENT_STATUS_LABELS: Record<EventWorkflowStatus, string> = {
  upcoming: "Upcoming",
  active: "Active",
  ended: "Ended",
  inactive: "Inactive",
};

export const EVENT_STATUS_FILTER_OPTIONS = (
  ["upcoming", "active", "ended", "inactive"] as const
).map((value) => ({
  value,
  label: EVENT_STATUS_LABELS[value],
}));

export function parseEventStatusFilterParam(
  statusParam: string | null,
): string[] {
  if (!statusParam?.trim()) return [];
  return statusParam
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isEventStatusFilterChecked(
  token: string,
  statusParam: string | null,
): boolean {
  return parseEventStatusFilterParam(statusParam).includes(token);
}

export function toggleEventStatusFilter(
  token: string,
  statusParam: string | null,
): string | null {
  const current = parseEventStatusFilterParam(statusParam);
  const idx = current.indexOf(token);
  if (idx >= 0) {
    const next = current.filter((t) => t !== token);
    return next.length > 0 ? next.join(",") : null;
  }
  return [...current, token].join(",");
}

export function eventStatusFilterSelectionLabels(
  statusParam: string | null,
): string[] {
  const tokens = parseEventStatusFilterParam(statusParam);
  return tokens.map(
    (t) =>
      EVENT_STATUS_FILTER_OPTIONS.find((o) => o.value === t)?.label ?? t,
  );
}
