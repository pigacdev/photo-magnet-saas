import { isPrintEligibleStatus } from "@/lib/orderDisplayStatus";

/** Seller print actions: order must be paid or in production. */
export function isReadyToPrint(order: { status: string }): boolean {
  return isPrintEligibleStatus(order.status);
}
