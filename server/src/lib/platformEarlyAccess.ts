import { EARLY_ACCESS_SEAT_LIMIT } from "../../../src/lib/earlyAccess";
import { prisma } from "./prisma";

export type PlatformEarlyAccessRow = {
  id: string;
  email: string;
  name: string | null;
  plan: "FREE" | "HOBBY" | "PRO";
  clerkPlanSlug: string | null;
  earlyAccessExpiresAt: string | null;
  grantLifetimeDiscount: boolean;
  eventCount: number;
  orderCount: number;
  lastOrderAt: string | null;
};

export type PlatformEarlyAccessResponse = {
  rows: PlatformEarlyAccessRow[];
  seatsTaken: number;
  seatLimit: number;
  plansFlippedAt: string | null;
};

export async function fetchPlatformEarlyAccess(): Promise<PlatformEarlyAccessResponse> {
  const [counter, orgs] = await Promise.all([
    prisma.earlyAccessCounter.findUnique({
      where: { id: 1 },
      select: { seatsTaken: true, plansFlippedAt: true },
    }),
    prisma.organization.findMany({
      where: { isEarlyAccess: true },
      select: {
        id: true,
        plan: true,
        clerkPlanSlug: true,
        earlyAccessExpiresAt: true,
        grantLifetimeDiscount: true,
        user: {
          select: { email: true, name: true },
        },
      },
      orderBy: { earlyAccessExpiresAt: "asc" },
    }),
  ]);

  const orgIds = orgs.map((o) => o.id);

  const [eventCounts, orderStats] = await Promise.all([
    orgIds.length > 0
      ? prisma.event.groupBy({
          by: ["userId"],
          where: { userId: { in: orgIds }, deletedAt: null },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    orgIds.length > 0
      ? prisma.order.groupBy({
          by: ["organizationId"],
          where: { organizationId: { in: orgIds } },
          _count: { _all: true },
          _max: { createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  const eventCountByUser = new Map(
    eventCounts.map((row) => [row.userId, row._count._all]),
  );
  const orderStatsByOrg = new Map(
    orderStats.map((row) => [
      row.organizationId,
      { count: row._count._all, lastAt: row._max.createdAt },
    ]),
  );

  const rows: PlatformEarlyAccessRow[] = orgs.map((org) => {
    const stats = orderStatsByOrg.get(org.id);
    return {
      id: org.id,
      email: org.user.email,
      name: org.user.name,
      plan: org.plan,
      clerkPlanSlug: org.clerkPlanSlug,
      earlyAccessExpiresAt: org.earlyAccessExpiresAt?.toISOString() ?? null,
      grantLifetimeDiscount: org.grantLifetimeDiscount,
      eventCount: eventCountByUser.get(org.id) ?? 0,
      orderCount: stats?.count ?? 0,
      lastOrderAt: stats?.lastAt?.toISOString() ?? null,
    };
  });

  return {
    rows,
    seatsTaken: counter?.seatsTaken ?? 0,
    seatLimit: EARLY_ACCESS_SEAT_LIMIT,
    plansFlippedAt: counter?.plansFlippedAt?.toISOString() ?? null,
  };
}

export async function setGrantLifetimeDiscount(
  orgId: string,
  grantLifetimeDiscount: boolean,
): Promise<boolean> {
  const org = await prisma.organization.findFirst({
    where: { id: orgId, isEarlyAccess: true },
    select: { id: true },
  });
  if (!org) return false;

  await prisma.organization.update({
    where: { id: orgId },
    data: { grantLifetimeDiscount },
  });
  return true;
}
