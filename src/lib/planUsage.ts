import type { OrganizationUsage } from "@/lib/auth";
import { hasUnlimitedEvents, hasUnlimitedOrders } from "@/lib/planCatalog";

export type PlanUsageLevel = "normal" | "warning" | "reached";

export function usageWarningThreshold(orderLimit: number): number {
  if (orderLimit <= 0) return 0;
  return Math.ceil(orderLimit * 0.7);
}

export function getPlanUsageLevel(usage: OrganizationUsage): PlanUsageLevel {
  if (hasUnlimitedOrders(usage.orderLimit)) return "normal";
  if (usage.ordersThisMonth >= usage.orderLimit) return "reached";
  if (usage.ordersThisMonth >= usageWarningThreshold(usage.orderLimit)) {
    return "warning";
  }
  return "normal";
}

export function usageBarFillClass(level: PlanUsageLevel): string {
  switch (level) {
    case "warning":
      return "bg-orange-500";
    case "reached":
      return "bg-red-600";
    default:
      return "bg-primary";
  }
}

export function usageBarFillClassCompact(level: PlanUsageLevel): string {
  switch (level) {
    case "warning":
      return "bg-orange-500";
    case "reached":
      return "bg-red-600";
    default:
      return "bg-foreground";
  }
}

export function usagePercentage(usage: OrganizationUsage): number {
  if (hasUnlimitedOrders(usage.orderLimit) || usage.orderLimit <= 0) return 0;
  return Math.min(
    100,
    Math.round((usage.ordersThisMonth / usage.orderLimit) * 100),
  );
}

export function showMonthlyUsageMeter(usage: OrganizationUsage): boolean {
  return !hasUnlimitedOrders(usage.orderLimit);
}

function eventLimitFor(usage: OrganizationUsage): number {
  return usage.eventLimit ?? 1;
}

function eventsCreatedFor(usage: OrganizationUsage): number {
  return usage.eventsCreatedThisMonth ?? 0;
}

export function getEventUsageLevel(usage: OrganizationUsage): PlanUsageLevel {
  const limit = eventLimitFor(usage);
  const created = eventsCreatedFor(usage);
  if (hasUnlimitedEvents(limit)) return "normal";
  if (created >= limit) return "reached";
  if (created >= usageWarningThreshold(limit)) {
    return "warning";
  }
  return "normal";
}

export function showMonthlyEventUsageMeter(usage: OrganizationUsage): boolean {
  return !hasUnlimitedEvents(eventLimitFor(usage));
}

export function eventUsagePercentage(usage: OrganizationUsage): number {
  const limit = eventLimitFor(usage);
  if (hasUnlimitedEvents(limit) || limit <= 0) return 0;
  return Math.min(
    100,
    Math.round((eventsCreatedFor(usage) / limit) * 100),
  );
}
