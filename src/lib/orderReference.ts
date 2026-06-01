/** Customer/seller-facing order reference (matches dashboard orders list). */
export function formatOrderReference(order: {
  id: string;
  shortCode?: string | null;
}): string {
  const code = order.shortCode?.trim();
  if (code) return code;
  return order.id.slice(0, 8);
}
