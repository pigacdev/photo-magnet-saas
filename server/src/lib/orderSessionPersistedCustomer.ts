import type { ContextType } from "../../../src/generated/prisma/client";
import type { Prisma } from "../../../src/generated/prisma/client";

type OrderSessionWithCheckoutFields = {
  contextType: ContextType;
  checkoutCustomerName: string | null;
  checkoutCustomerPhone: string | null;
  checkoutShippingType: string | null;
  checkoutShippingAddress: Prisma.JsonValue;
};

/**
 * Build the object shape expected by `validateOrderCustomerBody` from persisted session columns.
 * Returns `null` if a customer snapshot has not been saved yet.
 */
export function customerBodyFromOrderSessionRow(
  row: OrderSessionWithCheckoutFields,
): Record<string, unknown> | null {
  if (!row.checkoutCustomerName?.trim()) return null;
  const body: Record<string, unknown> = {
    customerName: row.checkoutCustomerName,
    customerPhone: row.checkoutCustomerPhone ?? null,
  };
  if (row.contextType === "STOREFRONT") {
    body.shippingType = row.checkoutShippingType ?? null;
    body.shippingAddress = row.checkoutShippingAddress;
  }
  return body;
}
