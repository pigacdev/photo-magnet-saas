import type { OrderStatus } from "../../../src/generated/prisma/client";

export const ORDER_STATUSES: OrderStatus[] = [
  "NEW",
  "CONFIRMED",
  "INVOICE_SENT",
  "PAID",
  "IN_PRODUCTION",
  "SHIPPED",
  "COMPLETED",
  "CANCELLED",
];

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["INVOICE_SENT", "PAID", "CANCELLED"],
  INVOICE_SENT: ["PAID", "CANCELLED"],
  PAID: ["IN_PRODUCTION", "CANCELLED"],
  IN_PRODUCTION: ["SHIPPED"],
  SHIPPED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function isValidOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as string[]).includes(value);
}

export function canTransitionOrderStatus(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Orders eligible for seller print actions. */
export function isPrintEligibleStatus(status: OrderStatus): boolean {
  return (
    status === "PAID" ||
    status === "IN_PRODUCTION" ||
    status === "SHIPPED" ||
    status === "COMPLETED"
  );
}

export function parseEventPaymentPreference(
  value: unknown,
): string | null {
  if (typeof value !== "string") return null;
  const pm = value.trim().toLowerCase();
  if (pm === "cash" || pm === "card_on_location" || pm === "card on location") {
    return pm === "cash" ? "cash" : "card_on_location";
  }
  return null;
}

export const MAX_CANCELLATION_NOTE_LENGTH = 500;

/** Returns trimmed note or null; throws message for invalid input. */
export function parseCancellationNote(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("cancellationNote must be a string");
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_CANCELLATION_NOTE_LENGTH) {
    throw new Error(
      `cancellationNote must be at most ${MAX_CANCELLATION_NOTE_LENGTH} characters`,
    );
  }
  return trimmed;
}
