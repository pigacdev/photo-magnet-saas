/**
 * Seller-facing computed status from GET /api/orders (matches server `getDisplayStatus`).
 */
export type OrderDisplayStatus =
  | "SHIPPED"
  | "PRINTED"
  | "READY_TO_PRINT"
  | "AWAITING_PAYMENT"
  | "UNKNOWN";

export const ORDER_DISPLAY_STATUS_LABELS: Record<OrderDisplayStatus, string> = {
  AWAITING_PAYMENT: "Awaiting payment",
  READY_TO_PRINT: "Ready to print",
  PRINTED: "Printed",
  SHIPPED: "Shipped",
  UNKNOWN: "Unknown",
};

export function orderDisplayStatusBadgeClass(status: OrderDisplayStatus): string {
  switch (status) {
    case "AWAITING_PAYMENT":
      return "bg-gray-100 text-[#6B7280]";
    case "READY_TO_PRINT":
      return "bg-blue-50 text-[#1D4ED8]";
    case "PRINTED":
      return "bg-orange-50 text-[#C2410C]";
    case "SHIPPED":
      return "bg-green-50 text-[#16A34A]";
    default:
      return "bg-gray-100 text-[#6B7280]";
  }
}

export function OrderDisplayStatusBadge({
  displayStatus,
}: {
  displayStatus: OrderDisplayStatus;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${orderDisplayStatusBadgeClass(displayStatus)}`}
    >
      {ORDER_DISPLAY_STATUS_LABELS[displayStatus]}
    </span>
  );
}
