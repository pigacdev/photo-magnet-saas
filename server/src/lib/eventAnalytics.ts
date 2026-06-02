import type { AllowedShape } from "../../../src/generated/prisma/client";
import { EVENT_MEDIA_RETENTION_HOURS_AFTER_END } from "../config/mediaRetention";
import { isOrderSettled } from "./orderSettlement";
import { prisma } from "./prisma";

const MS_PER_HOUR = 60 * 60 * 1000;

type OrderRow = {
  id: string;
  status: string;
  eventPaymentPreference: string | null;
  totalPrice: { toString: () => string };
  currency: string;
  createdAt: Date;
  customerPhone: string | null;
  customerName: string | null;
  orderImages: { shapeId: string; copies: number }[];
};

function customerIdentityKey(o: OrderRow): string {
  const p = o.customerPhone?.trim();
  if (p) return `phone:${p}`;
  const n = o.customerName?.trim();
  if (n) return `name:${n.toLowerCase()}`;
  return `order:${o.id}`;
}

export function shapeLabel(shape: Pick<AllowedShape, "shapeType" | "widthMm" | "heightMm">): string {
  return `${shape.shapeType} ${shape.widthMm}×${shape.heightMm} mm`;
}

/** UTC calendar date YYYY-MM-DD. */
function utcYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function decimalToNumber(d: OrderRow["totalPrice"]): number {
  const n = Number(d.toString());
  return Number.isFinite(n) ? n : 0;
}

type ShapeAgg = {
  shapeId: string;
  shapeName: string;
  orderIds: Set<string>;
  images: number;
  copies: number;
  revenue: number;
};

type PaymentAgg = {
  key: string;
  label: string;
  orderIds: Set<string>;
  revenue: number;
};

export type EventAnalyticsResponse = {
  event: {
    eventId: string;
    eventName: string;
    startDate: string;
    endDate: string;
    startsAt: string;
    endsAt: string;
    isEnded: boolean;
    mediaDeletionAt: string;
    mediaDeletionCountdownSeconds: number | null;
  };
  metrics: {
    totalOrders: number;
    paidOrders: number;
    pendingPaymentOrders: number;
    totalRevenue: number;
    currency: string;
    averageOrderValue: number;
    uniqueCustomers: number;
    totalImages: number;
    totalCopies: number;
    averageImagesPerOrder: number;
    averageCopiesPerOrder: number;
  };
  salesByShape: Array<{
    shapeId: string;
    shapeName: string;
    orders: number;
    images: number;
    copies: number;
    revenue: number;
  }>;
  paymentBreakdown: Array<{
    key: string;
    label: string;
    orders: number;
    revenue: number;
  }>;
  ordersByDay: Array<{
    date: string;
    orders: number;
    revenue: number;
  }>;
};

function getShapeAggsMap(
  allowedShapes: AllowedShape[],
): Map<string, ShapeAgg> {
  const map = new Map<string, ShapeAgg>();
  for (const s of allowedShapes) {
    map.set(s.id, {
      shapeId: s.id,
      shapeName: shapeLabel(s),
      orderIds: new Set(),
      images: 0,
      copies: 0,
      revenue: 0,
    });
  }
  return map;
}

function ensureShapeAgg(
  map: Map<string, ShapeAgg>,
  shapeId: string,
  fallbackName: string,
): ShapeAgg {
  let a = map.get(shapeId);
  if (!a) {
    a = {
      shapeId,
      shapeName: fallbackName,
      orderIds: new Set(),
      images: 0,
      copies: 0,
      revenue: 0,
    };
    map.set(shapeId, a);
  }
  return a;
}

/**
 * Loads analytics for one event owned by `sellerUserId` (`Event.userId` / `Order.organizationId`).
 * Returns `null` if the event is missing or soft-deleted.
 */
export async function getEventAnalyticsForSeller(
  eventId: string,
  sellerUserId: string,
): Promise<EventAnalyticsResponse | null> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, userId: sellerUserId, deletedAt: null },
  });

  if (!event) return null;

  const allowedShapes = await prisma.allowedShape.findMany({
    where: { contextType: "EVENT", contextId: eventId },
    orderBy: { displayOrder: "asc" },
  });

  const orders = await prisma.order.findMany({
    where: {
      organizationId: sellerUserId,
      contextType: "EVENT",
      contextId: eventId,
    },
    select: {
      id: true,
      status: true,
      eventPaymentPreference: true,
      totalPrice: true,
      currency: true,
      createdAt: true,
      customerPhone: true,
      customerName: true,
      orderImages: { select: { shapeId: true, copies: true } },
    },
  });

  const now = new Date();
  const isEnded = now > event.endDate;
  const mediaDeletionAt = new Date(
    event.endDate.getTime() +
      EVENT_MEDIA_RETENTION_HOURS_AFTER_END * MS_PER_HOUR,
  );
  let mediaDeletionCountdownSeconds: number | null = null;
  if (isEnded && mediaDeletionAt.getTime() > now.getTime()) {
    mediaDeletionCountdownSeconds = Math.floor(
      (mediaDeletionAt.getTime() - now.getTime()) / 1000,
    );
  }

  const totalOrders = orders.length;
  let paidOrders = 0;
  let pendingPaymentOrders = 0;
  let totalRevenue = 0;
  const uniqueCustomerKeys = new Set<string>();
  let totalImages = 0;
  let totalCopies = 0;
  let currency = "EUR";

  const shapeMap = getShapeAggsMap(allowedShapes);

  const paymentBuckets: Record<string, PaymentAgg> = {
    awaiting_payment: {
      key: "awaiting_payment",
      label: "Awaiting payment",
      orderIds: new Set(),
      revenue: 0,
    },
    paid: {
      key: "paid",
      label: "Paid",
      orderIds: new Set(),
      revenue: 0,
    },
    in_production: {
      key: "in_production",
      label: "In production / shipped",
      orderIds: new Set(),
      revenue: 0,
    },
  };

  const seriesEndMs = Math.max(event.endDate.getTime(), now.getTime());
  const rangeEnd = startOfUtcDay(new Date(seriesEndMs));

  const earliestOrderAt =
    orders.length > 0
      ? orders.reduce(
          (min, o) => (o.createdAt < min ? o.createdAt : min),
          orders[0].createdAt,
        )
      : null;
  let rangeStart = startOfUtcDay(event.startDate);
  if (
    earliestOrderAt != null &&
    startOfUtcDay(earliestOrderAt).getTime() < rangeStart.getTime()
  ) {
    rangeStart = startOfUtcDay(earliestOrderAt);
  }

  const byDay = new Map<string, { orders: number; revenue: number }>();
  const dayCursor = new Date(rangeStart);
  while (dayCursor.getTime() <= rangeEnd.getTime()) {
    byDay.set(utcYmd(dayCursor), { orders: 0, revenue: 0 });
    dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);
  }

  for (const o of orders) {
    uniqueCustomerKeys.add(customerIdentityKey(o));
    totalImages += o.orderImages.length;
    for (const img of o.orderImages) {
      totalCopies += img.copies;
    }

    const dayKey = utcYmd(o.createdAt);
    const dayEntry = byDay.get(dayKey);
    if (dayEntry) dayEntry.orders += 1;

    const paid = isOrderSettled(o);
    if (paid) {
      paidOrders += 1;
      const amount = decimalToNumber(o.totalPrice);
      totalRevenue += amount;
      currency = o.currency || currency;

      if (dayEntry) dayEntry.revenue += amount;

      const payKey =
        o.status === "PAID" ? "paid" : "in_production";
      paymentBuckets[payKey].orderIds.add(o.id);
      paymentBuckets[payKey].revenue += amount;

      const copiesByShape = new Map<string, number>();
      for (const img of o.orderImages) {
        copiesByShape.set(
          img.shapeId,
          (copiesByShape.get(img.shapeId) ?? 0) + img.copies,
        );
      }
      const orderCopyTotal = [...copiesByShape.values()].reduce(
        (a, b) => a + b,
        0,
      );
      if (orderCopyTotal > 0) {
        for (const [shapeId, c] of copiesByShape) {
          const agg = ensureShapeAgg(
            shapeMap,
            shapeId,
            shapeId.slice(0, 8),
          );
          const share = (c / orderCopyTotal) * amount;
          agg.revenue += share;
        }
      } else if (o.orderImages.length > 0) {
        const perShape = amount / o.orderImages.length;
        for (const img of o.orderImages) {
          const agg = ensureShapeAgg(
            shapeMap,
            img.shapeId,
            img.shapeId.slice(0, 8),
          );
          agg.revenue += perShape;
        }
      }
    } else {
      pendingPaymentOrders += 1;
      paymentBuckets.awaiting_payment.orderIds.add(o.id);
    }

    for (const img of o.orderImages) {
      const agg = ensureShapeAgg(
        shapeMap,
        img.shapeId,
        img.shapeId.slice(0, 8),
      );
      agg.orderIds.add(o.id);
      agg.images += 1;
      agg.copies += img.copies;
    }
  }

  const averageOrderValue =
    paidOrders > 0 ? totalRevenue / paidOrders : 0;
  const averageImagesPerOrder =
    totalOrders > 0 ? totalImages / totalOrders : 0;
  const averageCopiesPerOrder =
    totalOrders > 0 ? totalCopies / totalOrders : 0;

  const salesByShape = [...shapeMap.values()]
    .filter((s) => s.images > 0 || s.revenue > 0)
    .map((s) => ({
      shapeId: s.shapeId,
      shapeName: s.shapeName,
      orders: s.orderIds.size,
      images: s.images,
      copies: s.copies,
      revenue: Math.round(s.revenue * 100) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue || a.shapeId.localeCompare(b.shapeId));

  const paymentBreakdown = Object.values(paymentBuckets)
    .map((p) => ({
      key: p.key,
      label: p.label,
      orders: p.orderIds.size,
      revenue:
        p.key === "awaiting_payment"
          ? 0
          : Math.round(p.revenue * 100) / 100,
    }))
    .filter((p) => p.orders > 0 || p.revenue > 0);

  const ordersByDay = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      orders: v.orders,
      revenue: Math.round(v.revenue * 100) / 100,
    }));

  return {
    event: {
      eventId: event.id,
      eventName: event.name,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      startsAt: event.startDate.toISOString(),
      endsAt: event.endDate.toISOString(),
      isEnded,
      mediaDeletionAt: mediaDeletionAt.toISOString(),
      mediaDeletionCountdownSeconds,
    },
    metrics: {
      totalOrders,
      paidOrders,
      pendingPaymentOrders,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      currency,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      uniqueCustomers: uniqueCustomerKeys.size,
      totalImages,
      totalCopies,
      averageImagesPerOrder: Math.round(averageImagesPerOrder * 100) / 100,
      averageCopiesPerOrder: Math.round(averageCopiesPerOrder * 100) / 100,
    },
    salesByShape,
    paymentBreakdown,
    ordersByDay,
  };
}
