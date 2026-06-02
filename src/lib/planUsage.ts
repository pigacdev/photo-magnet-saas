import type { OrganizationUsage } from "@/lib/auth";

export type PlanUsageLevel = "normal" | "warning" | "reached";

export function usageWarningThreshold(orderLimit: number): number {
  if (orderLimit <= 0) return 0;
  return Math.ceil(orderLimit * 0.7);
}

export function getPlanUsageLevel(usage: OrganizationUsage): PlanUsageLevel {
  if (usage.plan === "PRO") return "normal";
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
  if (usage.plan !== "FREE" || usage.orderLimit <= 0) return 0;
  return Math.min(
    100,
    Math.round((usage.ordersThisMonth / usage.orderLimit) * 100),
  );
}
