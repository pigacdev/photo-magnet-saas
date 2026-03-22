type EventRecord = {
  isActive: boolean;
  startDate: Date;
  endDate: Date;
  deletedAt: Date | null;
};

export type EventStatus = "upcoming" | "active" | "ended";

export function getEventStatus(event: EventRecord): EventStatus {
  const now = new Date();

  if (now < event.startDate) return "upcoming";
  if (now > event.endDate) return "ended";
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
