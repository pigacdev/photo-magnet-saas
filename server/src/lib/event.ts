type EventRecord = {
  isActive: boolean;
  startDate: Date;
  endDate: Date;
  deletedAt: Date | null;
};

export type EventStatus = "upcoming" | "active" | "ended" | "inactive";

export function getEventStatus(event: EventRecord): EventStatus {
  const now = new Date();

  if (now > event.endDate) return "ended";
  if (!event.isActive) return "inactive";
  if (now < event.startDate) return "upcoming";
  return "active";
}

export function isEventOpen(event: EventRecord): boolean {
  if (event.deletedAt !== null) return false;
  if (!event.isActive) return false;

  return getEventStatus(event) === "active";
}

export function enrichEvent(event: EventRecord) {
  return {
    isOpen: isEventOpen(event),
    status: getEventStatus(event),
  };
}

export function validateNewEventSchedule(
  start: Date,
  end: Date,
  now: Date = new Date(),
): { ok: true } | { ok: false; error: string } {
  if (start >= end) {
    return { ok: false, error: "Start date must be before end date" };
  }
  if (start < now) {
    return { ok: false, error: "Start date cannot be in the past" };
  }
  if (end <= now) {
    return { ok: false, error: "End date must be in the future" };
  }
  return { ok: true };
}

export function getEventConfigurationIssues(
  shapeCount: number,
  pricingCount: number,
): string[] {
  const issues: string[] = [];
  if (shapeCount === 0) {
    issues.push("At least one magnet shape is required");
  }
  if (pricingCount === 0) {
    issues.push("Pricing is required");
  }
  return issues;
}

export function isEventConfigurationComplete(
  shapeCount: number,
  pricingCount: number,
): boolean {
  return getEventConfigurationIssues(shapeCount, pricingCount).length === 0;
}

/**
 * Event must be loadable with `deletedAt: null` by the caller.
 * Enforces: not soft-deleted (`isEventOpen` checks `deletedAt`), within open window + `isActive`,
 * at least one allowed shape, and at least one non-deleted pricing row.
 */
export function canAcceptOrders(
  event: EventRecord,
  pricingCount: number,
  shapeCount: number,
): { ok: true } | { ok: false; reason: string } {
  if (!isEventOpen(event)) {
    return { ok: false, reason: "Event is not open" };
  }
  const configIssues = getEventConfigurationIssues(shapeCount, pricingCount);
  if (configIssues.length > 0) {
    return { ok: false, reason: configIssues[0]! };
  }
  return { ok: true };
}
