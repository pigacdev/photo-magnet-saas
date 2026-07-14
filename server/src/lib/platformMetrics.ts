import type { Plan } from "../../../src/generated/prisma/client";
import {
  entitlementsForPlan,
  hasUnlimitedEvents,
  hasUnlimitedOrders,
} from "./planCatalog";
import { prisma } from "./prisma";
import {
  aggregateSettledMonthMetrics,
  SETTLED_ORDER_STATUSES,
} from "./orderSettlement";

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

function startOfPreviousMonthLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
}

function endOfPreviousMonthLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
}

function formatYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatYmLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
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

function buildLast30DayBuckets(): { date: string; signups: number }[] {
  const rows: { date: string; signups: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const anchor = new Date();
    anchor.setHours(12, 0, 0, 0);
    anchor.setDate(anchor.getDate() - i);
    rows.push({ date: formatYmdLocal(anchor), signups: 0 });
  }
  return rows;
}

function buildCurrentYearMonthBuckets(): {
  month: string;
  label: string;
  signups: number;
}[] {
  const now = new Date();
  const y = now.getFullYear();
  const currentMonthIndex = now.getMonth();
  const rows: { month: string; label: string; signups: number }[] = [];
  for (let m = 0; m <= currentMonthIndex; m++) {
    const mm = String(m + 1).padStart(2, "0");
    rows.push({
      month: `${y}-${mm}`,
      label: MONTH_SHORT_LABELS[m],
      signups: 0,
    });
  }
  return rows;
}

function buildYearBuckets(fromYear: number, toYear: number): {
  year: string;
  signups: number;
}[] {
  const rows: { year: string; signups: number }[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    rows.push({ year: String(y), signups: 0 });
  }
  return rows;
}

function isNearOrderLimit(used: number, plan: Plan): boolean {
  const limit = entitlementsForPlan(plan).orderLimit;
  if (hasUnlimitedOrders(limit)) return false;
  if (limit <= 0) return false;
  return used >= limit * 0.8 && used < limit;
}

function isOrderLimitReached(used: number, plan: Plan): boolean {
  const limit = entitlementsForPlan(plan).orderLimit;
  if (hasUnlimitedOrders(limit)) return false;
  if (limit <= 0) return false;
  return used >= limit;
}

function isNearEventLimit(used: number, plan: Plan): boolean {
  const limit = entitlementsForPlan(plan).eventLimit;
  if (hasUnlimitedEvents(limit)) return false;
  if (limit <= 0) return false;
  return used >= limit * 0.8 && used < limit;
}

function isEventLimitReached(used: number, plan: Plan): boolean {
  const limit = entitlementsForPlan(plan).eventLimit;
  if (hasUnlimitedEvents(limit)) return false;
  if (limit <= 0) return false;
  return used >= limit;
}

export type PlatformTenantUsageFilter =
  | "nearOrderLimit"
  | "nearEventLimit"
  | "orderLimitReached"
  | "eventLimitReached"
  | "onboardingIncomplete"
  | "erasurePending";

export function matchesTenantUsageFilter(
  tenant: {
    plan: Plan;
    ordersThisMonth: number;
    eventsThisMonth: number;
    onboardingComplete: boolean;
    erasureScheduledAt: string | null;
  },
  filter: PlatformTenantUsageFilter,
): boolean {
  switch (filter) {
    case "nearOrderLimit":
      return isNearOrderLimit(tenant.ordersThisMonth, tenant.plan);
    case "nearEventLimit":
      return isNearEventLimit(tenant.eventsThisMonth, tenant.plan);
    case "orderLimitReached":
      return isOrderLimitReached(tenant.ordersThisMonth, tenant.plan);
    case "eventLimitReached":
      return isEventLimitReached(tenant.eventsThisMonth, tenant.plan);
    case "onboardingIncomplete":
      return !tenant.onboardingComplete;
    case "erasurePending":
      return tenant.erasureScheduledAt != null;
  }
}

export type SignupMonthPoint = {
  month: string;
  label: string;
  signups: number;
};

export type SignupYearPoint = {
  year: string;
  signups: number;
};

export type PlatformOverview = {
  totalSellers: number;
  planBreakdown: Record<Plan, number>;
  signupsLast30Days: { date: string; signups: number }[];
  signupsByMonth: SignupMonthPoint[];
  signupsByYear: SignupYearPoint[];
  gmvThisMonth: number;
  gmvLastMonth: number;
  ordersThisMonth: number;
  activeSellersLast30Days: number;
  nearOrderLimit: number;
  nearEventLimit: number;
  orderLimitReached: number;
  eventLimitReached: number;
  onboardingIncomplete: number;
  pendingErasure: number;
};

export async function fetchPlatformOverview(): Promise<PlatformOverview> {
  const monthStart = startOfCurrentMonthLocal();
  const monthEnd = endOfCurrentMonthLocal();
  const prevMonthStart = startOfPreviousMonthLocal();
  const prevMonthEnd = endOfPreviousMonthLocal();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const settledWhere = { status: { in: [...SETTLED_ORDER_STATUSES] } };

  const [
    totalSellers,
    planGroups,
    allSignups,
    ordersThisMonthForGmv,
    ordersLastMonthForGmv,
    ordersThisMonth,
    activeSellerGroups,
    orgsForLimits,
    onboardingIncomplete,
    pendingErasure,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.organization.groupBy({
      by: ["plan"],
      _count: { plan: true },
      where: { user: { deletedAt: null } },
    }),
    prisma.user.findMany({
      where: { deletedAt: null },
      select: { createdAt: true },
    }),
    prisma.order.findMany({
      where: {
        createdAt: { gte: monthStart, lte: monthEnd },
        ...settledWhere,
      },
      select: {
        status: true,
        totalPrice: true,
        orderImages: { select: { copies: true } },
      },
    }),
    prisma.order.findMany({
      where: {
        createdAt: { gte: prevMonthStart, lte: prevMonthEnd },
        ...settledWhere,
      },
      select: {
        status: true,
        totalPrice: true,
        orderImages: { select: { copies: true } },
      },
    }),
    prisma.order.count({
      where: { createdAt: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.order.groupBy({
      by: ["organizationId"],
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.organization.findMany({
      where: { user: { deletedAt: null } },
      select: {
        plan: true,
        ordersThisMonth: true,
        eventsCreatedThisMonth: true,
      },
    }),
    prisma.organization.count({
      where: {
        currency: null,
        user: { deletedAt: null },
      },
    }),
    prisma.user.count({
      where: { erasureScheduledAt: { not: null } },
    }),
  ]);

  const planBreakdown: Record<Plan, number> = {
    FREE: 0,
    HOBBY: 0,
    PRO: 0,
  };
  for (const g of planGroups) {
    planBreakdown[g.plan] = g._count.plan;
  }

  const signupsLast30Days = buildLast30DayBuckets();
  const byDate = new Map(signupsLast30Days.map((r) => [r.date, r]));
  const signupsByMonth = buildCurrentYearMonthBuckets();
  const byMonth = new Map(signupsByMonth.map((r) => [r.month, r]));

  const now = new Date();
  const currentYear = now.getFullYear();
  let firstSignupYear = currentYear;
  for (const u of allSignups) {
    const created = u.createdAt;
    if (created >= thirtyDaysAgo) {
      const key = formatYmdLocal(created);
      const dayRow = byDate.get(key);
      if (dayRow) dayRow.signups += 1;
    }

    const monthKey = formatYmLocal(created);
    const monthRow = byMonth.get(monthKey);
    if (monthRow) monthRow.signups += 1;

    firstSignupYear = Math.min(firstSignupYear, created.getFullYear());
  }

  const signupsByYear = buildYearBuckets(firstSignupYear, currentYear);
  const byYear = new Map(signupsByYear.map((r) => [r.year, r]));
  for (const u of allSignups) {
    const yearKey = String(u.createdAt.getFullYear());
    const yearRow = byYear.get(yearKey);
    if (yearRow) yearRow.signups += 1;
  }

  const gmvThisMonth = aggregateSettledMonthMetrics(ordersThisMonthForGmv).revenue;
  const gmvLastMonth = aggregateSettledMonthMetrics(ordersLastMonthForGmv).revenue;

  let nearOrderLimit = 0;
  let nearEventLimit = 0;
  let orderLimitReached = 0;
  let eventLimitReached = 0;
  for (const org of orgsForLimits) {
    if (isNearOrderLimit(org.ordersThisMonth, org.plan)) nearOrderLimit += 1;
    if (isNearEventLimit(org.eventsCreatedThisMonth, org.plan)) {
      nearEventLimit += 1;
    }
    if (isOrderLimitReached(org.ordersThisMonth, org.plan)) orderLimitReached += 1;
    if (isEventLimitReached(org.eventsCreatedThisMonth, org.plan)) {
      eventLimitReached += 1;
    }
  }

  return {
    totalSellers,
    planBreakdown,
    signupsLast30Days,
    signupsByMonth,
    signupsByYear,
    gmvThisMonth,
    gmvLastMonth,
    ordersThisMonth,
    activeSellersLast30Days: activeSellerGroups.length,
    nearOrderLimit,
    nearEventLimit,
    orderLimitReached,
    eventLimitReached,
    onboardingIncomplete,
    pendingErasure,
  };
}

export type PlatformTenantRow = {
  id: string;
  email: string;
  name: string | null;
  businessName: string | null;
  plan: Plan;
  clerkPlanSlug: string | null;
  createdAt: string;
  ordersThisMonth: number;
  orderLimit: number;
  eventsThisMonth: number;
  eventLimit: number;
  totalSettledOrders: number;
  settledRevenue: number;
  eventCount: number;
  storefrontCount: number;
  lastOrderAt: string | null;
  onboardingComplete: boolean;
  erasureScheduledAt: string | null;
};

export type PlatformTenantsResult = {
  tenants: PlatformTenantRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type TenantSort = "createdAt" | "ordersThisMonth" | "settledRevenue";
export type TenantOrder = "asc" | "desc";

export type PlatformTenantFilters = {
  search?: string;
  sort: TenantSort;
  order: TenantOrder;
  usageFilter?: PlatformTenantUsageFilter;
};

/** All sellers matching table filters (no pagination). */
export async function resolveAllFilteredPlatformTenants(
  opts: PlatformTenantFilters,
): Promise<PlatformTenantRow[]> {
  const { search, sort, order, usageFilter } = opts;
  const searchTrim = search?.trim();

  const searchClause = searchTrim
    ? {
        OR: [
          { email: { contains: searchTrim, mode: "insensitive" as const } },
          { name: { contains: searchTrim, mode: "insensitive" as const } },
          {
            organization: {
              name: { contains: searchTrim, mode: "insensitive" as const },
            },
          },
        ],
      }
    : null;

  const visibilityClause =
    usageFilter === "erasurePending"
      ? { erasureScheduledAt: { not: null } }
      : {
          OR: [
            { deletedAt: null },
            { erasureScheduledAt: { not: null } },
          ],
        };

  const where = searchClause
    ? { AND: [visibilityClause, searchClause] }
    : visibilityClause;

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      erasureScheduledAt: true,
      organization: {
        select: {
          plan: true,
          clerkPlanSlug: true,
          name: true,
          ordersThisMonth: true,
          orderLimit: true,
          eventsCreatedThisMonth: true,
          eventLimit: true,
          currency: true,
        },
      },
      _count: {
        select: {
          events: { where: { deletedAt: null } },
          storefronts: { where: { deletedAt: null } },
        },
      },
    },
  });

  const orgIds = users.map((u) => u.id);
  const [revenueGroups, lastOrderGroups, settledCountGroups] = await Promise.all([
    prisma.order.groupBy({
      by: ["organizationId"],
      where: {
        organizationId: { in: orgIds },
        status: { in: [...SETTLED_ORDER_STATUSES] },
      },
      _sum: { totalPrice: true },
    }),
    prisma.order.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: orgIds } },
      _max: { createdAt: true },
    }),
    prisma.order.groupBy({
      by: ["organizationId"],
      where: {
        organizationId: { in: orgIds },
        status: { in: [...SETTLED_ORDER_STATUSES] },
      },
      _count: { id: true },
    }),
  ]);

  const revenueByOrg = new Map(
    revenueGroups.map((g) => [
      g.organizationId,
      Math.round(Number(g._sum.totalPrice ?? 0) * 100) / 100,
    ]),
  );
  const lastOrderByOrg = new Map(
    lastOrderGroups.map((g) => [g.organizationId, g._max.createdAt]),
  );
  const settledCountByOrg = new Map(
    settledCountGroups.map((g) => [g.organizationId, g._count.id]),
  );

  const rows: PlatformTenantRow[] = users.map((u) => {
    const org = u.organization;
    const settledRevenue = revenueByOrg.get(u.id) ?? 0;
    const lastOrder = lastOrderByOrg.get(u.id);

    return {
      id: u.id,
      email: u.email,
      name: u.name,
      businessName: org?.name ?? null,
      plan: org?.plan ?? "FREE",
      clerkPlanSlug: org?.clerkPlanSlug ?? null,
      createdAt: u.createdAt.toISOString(),
      ordersThisMonth: org?.ordersThisMonth ?? 0,
      orderLimit: org?.orderLimit ?? 0,
      eventsThisMonth: org?.eventsCreatedThisMonth ?? 0,
      eventLimit: org?.eventLimit ?? 0,
      totalSettledOrders: settledCountByOrg.get(u.id) ?? 0,
      settledRevenue,
      eventCount: u._count.events,
      storefrontCount: u._count.storefronts,
      lastOrderAt: lastOrder ? lastOrder.toISOString() : null,
      onboardingComplete: org?.currency != null,
      erasureScheduledAt: u.erasureScheduledAt?.toISOString() ?? null,
    };
  });

  const dir = order === "asc" ? 1 : -1;
  let filteredRows = rows;
  if (usageFilter) {
    filteredRows = rows.filter((row) => matchesTenantUsageFilter(row, usageFilter));
  }
  filteredRows.sort((a, b) => {
    if (sort === "ordersThisMonth") {
      return (a.ordersThisMonth - b.ordersThisMonth) * dir;
    }
    if (sort === "settledRevenue") {
      return (a.settledRevenue - b.settledRevenue) * dir;
    }
    return (
      (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir
    );
  });

  return filteredRows;
}

export async function fetchPlatformTenants(opts: {
  page: number;
  pageSize: number;
} & PlatformTenantFilters): Promise<PlatformTenantsResult> {
  const { page, pageSize, ...filters } = opts;
  const filteredRows = await resolveAllFilteredPlatformTenants(filters);
  const total = filteredRows.length;
  const start = (page - 1) * pageSize;
  const tenants = filteredRows.slice(start, start + pageSize);

  return { tenants, total, page, pageSize };
}
