import type { EventStatus } from "./event";

/** Keep in sync with `src/lib/eventDisplayStatus.tsx` filter tokens. */
export const EVENT_STATUS_FILTER_PARAMS = [
  "upcoming",
  "active",
  "ended",
  "inactive",
] as const;

export type EventStatusFilterParam = (typeof EVENT_STATUS_FILTER_PARAMS)[number];

const FILTER_PARAM_TO_STATUS = Object.fromEntries(
  EVENT_STATUS_FILTER_PARAMS.map((p) => [p, p]),
) as Record<EventStatusFilterParam, EventStatus>;

const ATOMIC_FILTER_PARAMS = new Set<string>(EVENT_STATUS_FILTER_PARAMS);

export function isKnownEventStatusFilterToken(token: string): boolean {
  return ATOMIC_FILTER_PARAMS.has(token.trim().toLowerCase());
}

export function expandEventStatusFilterParams(
  params: string[],
): Set<EventStatus> {
  const out = new Set<EventStatus>();
  for (const raw of params) {
    const p = raw.trim().toLowerCase() as EventStatusFilterParam;
    const status = FILTER_PARAM_TO_STATUS[p];
    if (status) out.add(status);
  }
  return out;
}

const STATUS_SORT_ORDER: readonly EventStatus[] = [
  "active",
  "upcoming",
  "inactive",
  "ended",
];

export function eventStatusSortPriority(status: EventStatus): number {
  const idx = STATUS_SORT_ORDER.indexOf(status);
  return idx === -1 ? STATUS_SORT_ORDER.length : idx;
}
