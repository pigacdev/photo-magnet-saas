/**
 * Seller print actions: order must reflect settled payment (`status` + `paymentStatus`).
 */
export function isReadyToPrint(order: {
  status: string;
  paymentStatus: string;
}): boolean {
  return order.status === "PAID" && order.paymentStatus === "PAID";
}
