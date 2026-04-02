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

/**
 * Event must be loadable with `deletedAt: null` by the caller.
 * Enforces: not soft-deleted (`isEventOpen` checks `deletedAt`), within open window + `isActive`,
 * and at least one non-deleted pricing row (`pricingCount` from `Pricing` where `deletedAt: null`).
 */
export function canAcceptOrders(event: EventRecord, pricingCount: number): { ok: true } | { ok: false; reason: string } {
  if (!isEventOpen(event)) {
    return { ok: false, reason: "Event is not open" };
  }
  if (pricingCount === 0) {
    return { ok: false, reason: "Pricing not configured" };
  }
  return { ok: true };
}
