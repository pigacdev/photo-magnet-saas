/**
 * Seller print actions: whether the order is allowed to enter the print flow (DB payment enum only).
 */
export function isReadyToPrint(status: string): boolean {
  return status === "PAID" || status === "PENDING_CASH";
}
