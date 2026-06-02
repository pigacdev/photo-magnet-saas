import type { OrderStatus } from "../../../src/generated/prisma/client";
import { ORDER_STATUSES } from "./orderStatus";

/** Keep in sync with `src/lib/orderDisplayStatus.tsx` filter tokens. */
const STATUS_TO_FILTER_PARAM: Record<OrderStatus, string> = {
  NEW: "new",
  CONFIRMED: "confirmed",
  INVOICE_SENT: "invoice_sent",
  PAID: "paid",
  IN_PRODUCTION: "in_production",
  SHIPPED: "shipped",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

const FILTER_PARAM_TO_STATUS = Object.fromEntries(
  ORDER_STATUSES.map((s) => [STATUS_TO_FILTER_PARAM[s], s]),
) as Record<string, OrderStatus>;

const FILTER_GROUP_KEYS = new Set(["unpaid"]);

const ATOMIC_FILTER_PARAMS = new Set(Object.values(STATUS_TO_FILTER_PARAM));

const UNPAID_STATUSES: readonly OrderStatus[] = [
  "NEW",
  "CONFIRMED",
  "INVOICE_SENT",
];

export function isKnownStatusFilterToken(token: string): boolean {
  const t = token.trim().toLowerCase();
  return FILTER_GROUP_KEYS.has(t) || ATOMIC_FILTER_PARAMS.has(t);
}

export function expandStatusFilterParams(params: string[]): Set<OrderStatus> {
  const out = new Set<OrderStatus>();
  for (const raw of params) {
    const p = raw.trim().toLowerCase();
    if (p === "unpaid") {
      for (const s of UNPAID_STATUSES) out.add(s);
      continue;
    }
    const status = FILTER_PARAM_TO_STATUS[p];
    if (status) out.add(status);
  }
  return out;
}

export function orderStatusSortPriority(status: OrderStatus): number {
  return ORDER_STATUSES.indexOf(status);
}
