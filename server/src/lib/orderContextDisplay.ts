import { prisma } from "./prisma";

export type OrderContextRef = {
  contextType: "EVENT" | "STOREFRONT";
  contextId: string;
};

function contextKey(contextType: "EVENT" | "STOREFRONT", contextId: string): string {
  return `${contextType}:${contextId}`;
}

/**
 * Resolves display name for an order's event or storefront (includes soft-deleted rows).
 */
export async function resolveOrderContextName(
  contextType: "EVENT" | "STOREFRONT",
  contextId: string,
): Promise<string | null> {
  if (contextType === "EVENT") {
    const ev = await prisma.event.findFirst({
      where: { id: contextId },
      select: { name: true },
    });
    return ev?.name?.trim() || null;
  }

  const sf = await prisma.storefront.findFirst({
    where: { id: contextId },
    select: { name: true },
  });
  return sf?.name?.trim() || null;
}

/**
 * Batch-resolves display names for a page of orders (two queries max).
 */
export async function resolveOrderContextNames(
  orders: OrderContextRef[],
): Promise<Map<string, string>> {
  const eventIds = [
    ...new Set(
      orders.filter((o) => o.contextType === "EVENT").map((o) => o.contextId),
    ),
  ];
  const storefrontIds = [
    ...new Set(
      orders
        .filter((o) => o.contextType === "STOREFRONT")
        .map((o) => o.contextId),
    ),
  ];

  const [events, storefronts] = await Promise.all([
    eventIds.length > 0
      ? prisma.event.findMany({
          where: { id: { in: eventIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    storefrontIds.length > 0
      ? prisma.storefront.findMany({
          where: { id: { in: storefrontIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const names = new Map<string, string>();
  for (const ev of events) {
    const name = ev.name?.trim();
    if (name) names.set(contextKey("EVENT", ev.id), name);
  }
  for (const sf of storefronts) {
    const name = sf.name?.trim();
    if (name) names.set(contextKey("STOREFRONT", sf.id), name);
  }
  return names;
}

export function getOrderContextNameFromMap(
  names: Map<string, string>,
  contextType: "EVENT" | "STOREFRONT",
  contextId: string,
): string | null {
  return names.get(contextKey(contextType, contextId)) ?? null;
}
