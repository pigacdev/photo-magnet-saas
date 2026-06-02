/** Customer/seller-facing order reference (matches dashboard orders list). */
export function formatOrderReference(order: {
  id: string;
  shortCode?: string | null;
}): string {
  const code = order.shortCode?.trim();
  if (code) return code;
  return order.id.slice(0, 8);
}

/** Normalize pasted order reference (trim, strip leading #). */
export function normalizeOrderReference(reference: string): string {
  return reference.trim().replace(/^#+/, "");
}
