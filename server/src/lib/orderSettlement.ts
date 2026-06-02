import type { OrderStatus } from "../../../src/generated/prisma/client";

export const SETTLED_ORDER_STATUSES: readonly OrderStatus[] = [
  "PAID",
  "IN_PRODUCTION",
  "SHIPPED",
  "COMPLETED",
] as const;

const SETTLED_STATUSES = new Set<string>(SETTLED_ORDER_STATUSES);

export const UNPAID_ORDER_STATUSES: readonly OrderStatus[] = [
  "NEW",
  "CONFIRMED",
  "INVOICE_SENT",
] as const;

export function isOrderSettled(o: { status: string }): boolean {
  return SETTLED_STATUSES.has(o.status);
}

export function isUnpaidOrderStatus(status: string): boolean {
  return (UNPAID_ORDER_STATUSES as readonly string[]).includes(status);
}

type OrderImageCopies = { copies: number };

type OrderForMagnetCount = {
  orderImages: readonly OrderImageCopies[];
};

/** Sum physical magnet copies for an order (copies ?? 1 per line item). */
export function countMagnetsInOrder(order: OrderForMagnetCount): number {
  let total = 0;
  for (const img of order.orderImages) {
    const c = img.copies;
    total += c >= 1 ? c : 1;
  }
  return total;
}

export type SettledMonthMetrics = {
  paidOrders: number;
  revenue: number;
  magnetsSold: number;
  averageOrderValue: number;
};

type OrderForSettledMetrics = {
  status: string;
  totalPrice: { toString: () => string } | number | string;
  orderImages: readonly OrderImageCopies[];
};

function decimalToNumber(d: OrderForSettledMetrics["totalPrice"]): number {
  const n = Number(typeof d === "object" && d !== null && "toString" in d ? d.toString() : d);
  return Number.isFinite(n) ? n : 0;
}

/** Aggregate AOV and magnets sold from orders created in a month (settled orders only). */
export function aggregateSettledMonthMetrics(
  orders: readonly OrderForSettledMetrics[],
): SettledMonthMetrics {
  let paidOrders = 0;
  let revenue = 0;
  let magnetsSold = 0;

  for (const o of orders) {
    if (!isOrderSettled(o)) continue;
    paidOrders += 1;
    revenue += decimalToNumber(o.totalPrice);
    magnetsSold += countMagnetsInOrder(o);
  }

  revenue = Math.round(revenue * 100) / 100;
  const averageOrderValue =
    paidOrders > 0 ? Math.round((revenue / paidOrders) * 100) / 100 : 0;

  return { paidOrders, revenue, magnetsSold, averageOrderValue };
}
