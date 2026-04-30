/**
 * Order detail copy for Payment vs Fulfillment. When `pickedUpAt` exists (future), add a branch
 * here and treat “done” like shipped: see `orderFulfillmentDisplay.tsx` roadmap comment.
 */
import { fulfillmentLabel } from "@/lib/orderFulfillmentDisplay";
import { isReadyToPrint } from "@/lib/sellerOrderPrintStatus";

/** Human payment line — DB `Order.status` / payment settlement (not fulfillment). */
export function PaymentClarityRow({
  status,
  contextType,
}: {
  status: string;
  contextType?: "EVENT" | "STOREFRONT";
}) {
  if (status === "PAID") {
    return (
      <div className="flex items-start gap-2.5">
        <span className="text-lg leading-none" aria-hidden>
          ✅
        </span>
        <div>
          <p className="text-sm font-semibold text-[#111111]">Paid</p>
          <p className="text-xs text-[#6B7280]">
            {contextType === "STOREFRONT"
              ? "Online payment completed"
              : "Payment confirmed"}
          </p>
        </div>
      </div>
    );
  }
  if (status === "PENDING_CASH") {
    return (
      <div className="flex items-start gap-2.5">
        <span className="text-lg leading-none" aria-hidden>
          💵
        </span>
        <div>
          <p className="text-sm font-semibold text-[#111111]">
            Offline payment
          </p>
          <p className="text-xs text-[#6B7280]">
            Cash or card at event — confirm when collected
          </p>
        </div>
      </div>
    );
  }
  if (status === "PENDING_PAYMENT") {
    return (
      <div className="flex items-start gap-2.5">
        <span className="text-lg leading-none" aria-hidden>
          ⏳
        </span>
        <div>
          <p className="text-sm font-semibold text-[#B45309]">Pending</p>
          <p className="text-xs text-[#6B7280]">Awaiting online checkout</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-lg leading-none" aria-hidden>
        ◻️
      </span>
      <div>
        <p className="text-sm font-semibold text-[#6B7280]">—</p>
        <p className="text-xs text-[#6B7280]">Payment status updating</p>
      </div>
    </div>
  );
}

function fulfillmentEmojiAndHint(
  key: "shipped" | "printed" | "ready" | "waiting",
): { emoji: string; hint: string } {
  switch (key) {
    case "shipped":
      return { emoji: "📦", hint: "Out for delivery or picked up" };
    case "printed":
      return { emoji: "🖨️", hint: "Packed or awaiting shipment" };
    case "ready":
      return { emoji: "🖨️", hint: "Ready to produce when you print" };
    case "waiting":
      return { emoji: "⏳", hint: "Complete payment before printing" };
    default:
      return { emoji: "◻️", hint: "" };
  }
}

/** Human fulfillment line — separate from payment. */
export function FulfillmentClarityRow(order: {
  shippedAt: string | null;
  printedAt: string | null;
  status: string;
  paymentStatus: string;
}) {
  const fl = fulfillmentLabel(order);

  let key: "shipped" | "printed" | "ready" | "waiting";
  if (order.shippedAt) key = "shipped";
  else if (order.printedAt) key = "printed";
  else if (isReadyToPrint(order)) key = "ready";
  else key = "waiting";

  const { emoji, hint } = fulfillmentEmojiAndHint(key);

  return (
    <div className="flex items-start gap-2.5">
      <span className="text-lg leading-none" aria-hidden>
        {emoji}
      </span>
      <div>
        <p className={`text-sm font-semibold ${fl.className}`}>{fl.label}</p>
        <p className="text-xs text-[#6B7280]">{hint}</p>
      </div>
    </div>
  );
}
