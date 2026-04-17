/**
 * Seller dashboard analytics (lightweight KPIs).
 */
import type { Request, Response } from "express";
import { Router } from "express";
import { prisma } from "../lib/prisma";

export const dashboardRouter = Router();

function endOfTodayLocal(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfCurrentMonthLocal(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfCurrentMonthLocal(): Date {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return new Date(y, m + 1, 0, 23, 59, 59, 999);
}

/** First moment of the previous calendar month (local). */
function startOfPreviousMonthLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
}

/** Last moment of the previous calendar month (local). */
function endOfPreviousMonthLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
}

/** Local calendar day as YYYY-MM-DD (for bucketing order.createdAt). */
function formatYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Oldest → newest: today − 6 … today, each row starts at zero orders/revenue. */
function buildLast7DayBuckets(): {
  date: string;
  orders: number;
  revenue: number;
}[] {
  const rows: { date: string; orders: number; revenue: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const anchor = new Date();
    anchor.setHours(12, 0, 0, 0);
    anchor.setDate(anchor.getDate() - i);
    rows.push({
      date: formatYmdLocal(anchor),
      orders: 0,
      revenue: 0,
    });
  }
  return rows;
}

const MONTH_SHORT_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** YYYY-MM in local timezone. */
function formatYmLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Jan … current month (current year), oldest → newest; no future months. */
function buildCurrentYearMonthBuckets(): {
  month: string;
  label: string;
  orders: number;
  revenue: number;
}[] {
  const now = new Date();
  const y = now.getFullYear();
  const currentMonthIndex = now.getMonth();
  const rows: {
    month: string;
    label: string;
    orders: number;
    revenue: number;
  }[] = [];
  for (let m = 0; m <= currentMonthIndex; m++) {
    const mm = String(m + 1).padStart(2, "0");
    rows.push({
      month: `${y}-${mm}`,
      label: MONTH_SHORT_LABELS[m],
      orders: 0,
      revenue: 0,
    });
  }
  return rows;
}

/** GET /api/dashboard/stats — KPIs for authenticated seller org (server-local calendar). */
dashboardRouter.get("/stats", async (req: Request, res: Response) => {
  const orgId = req.user!.userId;
  const todayEnd = endOfTodayLocal();
  const monthStart = startOfCurrentMonthLocal();
  const monthEnd = endOfCurrentMonthLocal();
  const prevMonthStart = startOfPreviousMonthLocal();
  const prevMonthEnd = endOfPreviousMonthLocal();

  const createdThisMonthWhere = {
    organizationId: orgId,
    createdAt: { gte: monthStart, lte: monthEnd },
  };
  const createdLastMonthWhere = {
    organizationId: orgId,
    createdAt: { gte: prevMonthStart, lte: prevMonthEnd },
  };

  const [
    ordersThisMonth,
    revenueThisMonthAgg,
    pendingPrints,
    waitingToShip,
    ordersLastMonth,
    revenueLastMonthAgg,
  ] = await prisma.$transaction([
    prisma.order.count({ where: createdThisMonthWhere }),
    prisma.order.aggregate({
      where: createdThisMonthWhere,
      _sum: { totalPrice: true },
    }),
    prisma.order.count({
      where: {
        organizationId: orgId,
        shippedAt: null,
        orderImages: { some: { printed: false } },
      },
    }),
    prisma.order.count({
      where: {
        organizationId: orgId,
        printedAt: { not: null },
        shippedAt: null,
      },
    }),
    prisma.order.count({ where: createdLastMonthWhere }),
    prisma.order.aggregate({
      where: createdLastMonthWhere,
      _sum: { totalPrice: true },
    }),
  ]);

  const sumM = revenueThisMonthAgg._sum.totalPrice;
  const revenueThisMonth =
    sumM == null ? 0 : Math.round(Number(sumM) * 100) / 100;
  const sumL = revenueLastMonthAgg._sum.totalPrice;
  const revenueLastMonth =
    sumL == null ? 0 : Math.round(Number(sumL) * 100) / 100;

  const last7Days = buildLast7DayBuckets();
  const byDate = new Map(last7Days.map((r) => [r.date, r]));
  const rangeStart7 = new Date();
  rangeStart7.setDate(rangeStart7.getDate() - 6);
  rangeStart7.setHours(0, 0, 0, 0);

  const ordersIn7d = await prisma.order.findMany({
    where: {
      organizationId: orgId,
      createdAt: { gte: rangeStart7, lte: todayEnd },
    },
    select: { createdAt: true, totalPrice: true },
  });

  for (const o of ordersIn7d) {
    const key = formatYmdLocal(o.createdAt);
    const row = byDate.get(key);
    if (!row) continue;
    row.orders += 1;
    row.revenue += Number(o.totalPrice);
  }
  for (const row of last7Days) {
    row.revenue = Math.round(row.revenue * 100) / 100;
  }

  const byMonth = buildCurrentYearMonthBuckets();
  const byMonthKey = new Map(byMonth.map((r) => [r.month, r]));
  const nowRef = new Date();
  const y = nowRef.getFullYear();
  const yearStart = new Date(y, 0, 1, 0, 0, 0, 0);
  const endOfCurrentMonth = new Date(y, nowRef.getMonth() + 1, 0, 23, 59, 59, 999);

  const ordersYtd = await prisma.order.findMany({
    where: {
      organizationId: orgId,
      createdAt: { gte: yearStart, lte: endOfCurrentMonth },
    },
    select: { createdAt: true, totalPrice: true },
  });

  for (const o of ordersYtd) {
    const key = formatYmLocal(o.createdAt);
    const row = byMonthKey.get(key);
    if (!row) continue;
    row.orders += 1;
    row.revenue += Number(o.totalPrice);
  }
  for (const row of byMonth) {
    row.revenue = Math.round(row.revenue * 100) / 100;
  }

  res.json({
    ordersThisMonth,
    revenueThisMonth,
    ordersLastMonth,
    revenueLastMonth,
    pendingPrints,
    waitingToShip,
    last7Days,
    byMonth,
  });
});
