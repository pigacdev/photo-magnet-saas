/**
 * Order detail — single workflow status display.
 */
import { orderStatusLabel } from "@/lib/orderDisplayStatus";

export function OrderStatusRow({
  status,
  cancellationNote,
}: {
  status: string;
  cancellationNote?: string | null;
}) {
  const label = orderStatusLabel(status);
  const trimmedNote = cancellationNote?.trim() ?? "";
  const hint =
    status === "NEW"
      ? "Review and confirm with the customer"
      : status === "CONFIRMED"
        ? "Order accepted — invoice or collect payment"
        : status === "INVOICE_SENT"
          ? "Waiting for customer payment"
          : status === "PAID"
            ? "Payment received — ready for production"
            : status === "IN_PRODUCTION"
              ? "Production in progress"
              : status === "SHIPPED"
                ? "Order dispatched"
                : status === "COMPLETED"
                  ? "Order closed"
                  : status === "CANCELLED"
                    ? trimmedNote.length > 0
                      ? `Note: ${trimmedNote}`
                      : "Order cancelled"
                    : "Update order status as you progress";

  return (
    <div className="flex items-start gap-2.5">
      <span className="text-lg leading-none" aria-hidden>
        {status === "PAID" || status === "COMPLETED"
          ? "✅"
          : status === "CANCELLED"
            ? "✕"
            : "📋"}
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

/** @deprecated Use OrderStatusRow */
export const PaymentClarityRow = OrderStatusRow;
