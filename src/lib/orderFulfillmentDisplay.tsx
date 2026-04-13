import { isReadyToPrint } from "@/lib/sellerOrderPrintStatus";

/**
 * Fulfillment milestones for the seller UI: shipped → printed → ready to print (when paid).
 *
 * **Roadmap (not implemented yet):** add `pickedUpAt` on `Order` for event pickup. Then treat
 * “fulfillment complete / handed off” as **`shippedAt != null OR pickedUpAt != null`** (mail vs
 * counter), and extend labels (e.g. “Pickup completed”) without removing `shippedAt` for shipped
 * orders.
 */
export function fulfillmentLabel(order: {
  shippedAt: string | null;
  printedAt: string | null;
  status: string;
}): { label: string; className: string } {
  if (order.shippedAt) {
    return { label: "Shipped", className: "text-[#16A34A]" };
  }
  if (order.printedAt) {
    return { label: "Printed", className: "text-[#C2410C]" };
  }
  if (isReadyToPrint(order.status)) {
    return { label: "Ready to print", className: "text-[#1D4ED8]" };
  }
  return { label: "—", className: "text-[#6B7280]" };
}

export function FulfillmentStatusBadge(order: {
  shippedAt: string | null;
  printedAt: string | null;
  status: string;
}) {
  const { label, className } = fulfillmentLabel(order);
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide bg-gray-100 ${className}`}
    >
      {label}
    </span>
  );
}
