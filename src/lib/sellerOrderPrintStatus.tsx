import {
  isPrintEligibleStatus,
  isPrintPreviewEligibleStatus,
} from "@/lib/orderDisplayStatus";

/** Seller print fulfillment: order must be paid or in production. */
export function isReadyToPrint(order: { status: string }): boolean {
  return isPrintEligibleStatus(order.status);
}

/** Seller print PDF preview: any active (non-cancelled) order. */
export function isReadyToPrintPreview(order: { status: string }): boolean {
  return isPrintPreviewEligibleStatus(order.status);
}
