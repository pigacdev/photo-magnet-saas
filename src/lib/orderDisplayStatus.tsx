/**
 * Seller-facing order workflow status labels (matches Prisma OrderStatus).
 */
export type OrderWorkflowStatus =
  | "NEW"
  | "CONFIRMED"
  | "INVOICE_SENT"
  | "PAID"
  | "IN_PRODUCTION"
  | "SHIPPED"
  | "COMPLETED"
  | "CANCELLED";

export const ORDER_STATUS_LABELS: Record<OrderWorkflowStatus, string> = {
  NEW: "New",
  CONFIRMED: "Confirmed",
  INVOICE_SENT: "Invoice sent",
  PAID: "Paid",
  IN_PRODUCTION: "In production",
  SHIPPED: "Shipped",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_BADGE_CLASS: Record<OrderWorkflowStatus, string> = {
  NEW: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  CONFIRMED: "bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300",
  INVOICE_SENT: "bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
  PAID: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  IN_PRODUCTION: "bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  SHIPPED: "bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300",
  COMPLETED: "bg-surface text-muted-foreground",
  CANCELLED: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status as OrderWorkflowStatus] ?? status;
}

export function isPrintEligibleStatus(status: string): boolean {
  return (
    status === "PAID" ||
    status === "IN_PRODUCTION" ||
    status === "SHIPPED" ||
    status === "COMPLETED"
  );
}

/** Allowed next statuses for seller actions (mirrors server orderStatus.ts). */
export const ORDER_STATUS_TRANSITIONS: Record<
  OrderWorkflowStatus,
  OrderWorkflowStatus[]
> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["INVOICE_SENT", "PAID", "CANCELLED"],
  INVOICE_SENT: ["PAID", "CANCELLED"],
  PAID: ["IN_PRODUCTION", "CANCELLED"],
  IN_PRODUCTION: ["SHIPPED"],
  SHIPPED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function nextStatusOptions(current: string): OrderWorkflowStatus[] {
  return ORDER_STATUS_TRANSITIONS[current as OrderWorkflowStatus] ?? [];
}
