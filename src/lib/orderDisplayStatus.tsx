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
  NEW: "bg-blue-50 text-[#1D4ED8]",
  CONFIRMED: "bg-indigo-50 text-indigo-800",
  INVOICE_SENT: "bg-purple-50 text-purple-800",
  PAID: "bg-green-50 text-[#16A34A]",
  IN_PRODUCTION: "bg-orange-50 text-[#C2410C]",
  SHIPPED: "bg-teal-50 text-teal-800",
  COMPLETED: "bg-gray-100 text-[#374151]",
  CANCELLED: "bg-red-50 text-red-700",
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
