import type { Customer } from "../../../src/generated/prisma/client";
import { prisma } from "./prisma";
import { getOrganizationCurrency } from "./organizationCurrency";
import {
  customerSearchWhere,
  SETTLED_ORDER_STATUSES,
  type CustomerListParams,
  type CustomerListSortBy,
} from "./sellerCustomerListQuery";

export type CustomerListItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  orderCount: number;
  totalSpent: string;
  currency: string;
  customerSince: string;
};

export type CustomerListStats = {
  totalCustomers: number;
  newCustomersThisMonth: number;
};

type CustomerWithStats = Customer & {
  orderCount: number;
  totalSpent: number;
};

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function decimalToNumber(d: { toString: () => string }): number {
  const n = Number(d.toString());
  return Number.isFinite(n) ? n : 0;
}

async function attachOrderStats(
  organizationId: string,
  customers: Customer[],
  currency: string,
): Promise<CustomerWithStats[]> {
  if (customers.length === 0) return [];

  const ids = customers.map((c) => c.id);

  const [orderCounts, settledSums] = await Promise.all([
    prisma.order.groupBy({
      by: ["customerId"],
      where: { customerId: { in: ids }, organizationId },
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ["customerId"],
      where: {
        customerId: { in: ids },
        organizationId,
        status: { in: [...SETTLED_ORDER_STATUSES] },
      },
      _sum: { totalPrice: true },
    }),
  ]);

  const countMap = new Map(
    orderCounts.map((r) => [r.customerId, r._count._all]),
  );
  const sumMap = new Map(
    settledSums.map((r) => [
      r.customerId,
      r._sum.totalPrice ? decimalToNumber(r._sum.totalPrice) : 0,
    ]),
  );

  return customers.map((c) => ({
    ...c,
    orderCount: countMap.get(c.id) ?? 0,
    totalSpent: sumMap.get(c.id) ?? 0,
  }));
}

function mapListItem(c: CustomerWithStats, currency: string): CustomerListItem {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    orderCount: c.orderCount,
    totalSpent: c.totalSpent.toFixed(2),
    currency,
    customerSince: c.createdAt.toISOString(),
  };
}

function sortCustomers(
  rows: CustomerWithStats[],
  sortBy: CustomerListSortBy,
  sortOrder: "asc" | "desc",
): CustomerWithStats[] {
  const dir = sortOrder === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case "name":
        cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        break;
      case "orderCount":
        cmp = a.orderCount - b.orderCount;
        break;
      case "totalSpent":
        cmp = a.totalSpent - b.totalSpent;
        break;
      case "createdAt":
      default:
        cmp = a.createdAt.getTime() - b.createdAt.getTime();
        break;
    }
    return cmp * dir;
  });
}

export async function queryCustomerListStats(
  organizationId: string,
): Promise<CustomerListStats> {
  const monthStart = startOfUtcMonth(new Date());
  const [totalCustomers, newCustomersThisMonth] = await Promise.all([
    prisma.customer.count({
      where: { organizationId, deletedAt: null },
    }),
    prisma.customer.count({
      where: {
        organizationId,
        deletedAt: null,
        createdAt: { gte: monthStart },
      },
    }),
  ]);
  return { totalCustomers, newCustomersThisMonth };
}

export async function queryCustomerList(
  organizationId: string,
  params: CustomerListParams,
): Promise<{
  items: CustomerListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  stats: CustomerListStats;
}> {
  const currency = await getOrganizationCurrency(organizationId);
  const where = customerSearchWhere(organizationId, params.search);
  const stats = await queryCustomerListStats(organizationId);

  const needsMemorySort =
    params.sortBy === "orderCount" || params.sortBy === "totalSpent";

  if (needsMemorySort) {
    const all = await prisma.customer.findMany({ where });
    const withStats = await attachOrderStats(organizationId, all, currency);
    const sorted = sortCustomers(
      withStats,
      params.sortBy,
      params.sortOrder,
    );
    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
    const page = Math.min(params.page, totalPages);
    const start = (page - 1) * params.pageSize;
    const pageRows = sorted.slice(start, start + params.pageSize);
    return {
      items: pageRows.map((c) => mapListItem(c, currency)),
      pagination: {
        page,
        pageSize: params.pageSize,
        total,
        totalPages,
      },
      stats,
    };
  }

  const orderBy =
    params.sortBy === "name"
      ? { name: params.sortOrder }
      : { createdAt: params.sortOrder };

  const total = await prisma.customer.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
  const page = Math.min(params.page, totalPages);
  const skip = (page - 1) * params.pageSize;

  const customers = await prisma.customer.findMany({
    where,
    orderBy,
    skip,
    take: params.pageSize,
  });

  const withStats = await attachOrderStats(organizationId, customers, currency);

  return {
    items: withStats.map((c) => mapListItem(c, currency)),
    pagination: {
      page,
      pageSize: params.pageSize,
      total,
      totalPages,
    },
    stats,
  };
}

export async function queryCustomersForExport(
  organizationId: string,
  search: string,
): Promise<
  Array<{
    name: string;
    email: string | null;
    phone: string | null;
    orderCount: number;
    totalSpent: string;
    currency: string;
    customerSince: Date;
  }>
> {
  const currency = await getOrganizationCurrency(organizationId);
  const where = customerSearchWhere(organizationId, search);
  const customers = await prisma.customer.findMany({
    where,
    orderBy: { name: "asc" },
  });
  const withStats = await attachOrderStats(organizationId, customers, currency);
  return withStats.map((c) => ({
    name: c.name,
    email: c.email,
    phone: c.phone,
    orderCount: c.orderCount,
    totalSpent: c.totalSpent.toFixed(2),
    currency,
    customerSince: c.createdAt,
  }));
}
