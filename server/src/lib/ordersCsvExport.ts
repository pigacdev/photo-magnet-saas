import { csvEscape } from "./csvEscape";
import { orderStatusDisplayLabel } from "./orderStatus";
import type { SellerOrderListMappedRow } from "./sellerOrderListQuery";

function formatOrderReference(order: {
  id: string;
  shortCode?: string | null;
}): string {
  const code = order.shortCode?.trim();
  if (code) return code;
  return order.id.slice(0, 8);
}

const CSV_HEADER = [
  "order_id",
  "date",
  "status",
  "total_amount",
  "currency",
  "customer_name",
  "customer_email",
  "customer_phone",
].join(",");

export function buildOrdersExportCsv(rows: SellerOrderListMappedRow[]): string {
  const lines: string[] = [CSV_HEADER];

  for (const { row } of rows) {
    const customerName = row.customerName?.trim() ? row.customerName : "Guest";
    lines.push(
      [
        csvEscape(formatOrderReference(row)),
        csvEscape(row.createdAt.toISOString()),
        csvEscape(orderStatusDisplayLabel(row.status)),
        csvEscape(row.totalPrice.toString()),
        csvEscape(row.currency ?? "EUR"),
        csvEscape(customerName),
        csvEscape(row.customerEmail ?? ""),
        csvEscape(row.customerPhone ?? ""),
      ].join(","),
    );
  }

  return `${lines.join("\r\n")}\r\n`;
}

export function ordersExportFilename(date = new Date()): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `orders-export-${y}-${mo}-${day}.csv`;
}
