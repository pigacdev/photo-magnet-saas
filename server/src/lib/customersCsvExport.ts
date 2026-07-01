import { csvEscape } from "./csvEscape";

export type CustomerExportRow = {
  name: string;
  email: string | null;
  phone: string | null;
  orderCount: number;
  totalSpent: string;
  currency: string;
  customerSince: Date;
};

const CSV_HEADER = [
  "customer_name",
  "email",
  "phone",
  "order_count",
  "total_spent",
  "currency",
  "customer_since",
].join(",");

export function buildCustomersExportCsv(rows: CustomerExportRow[]): string {
  const lines: string[] = [CSV_HEADER];

  for (const row of rows) {
    lines.push(
      [
        csvEscape(row.name),
        csvEscape(row.email ?? ""),
        csvEscape(row.phone ?? ""),
        csvEscape(String(row.orderCount)),
        csvEscape(row.totalSpent),
        csvEscape(row.currency),
        csvEscape(row.customerSince.toISOString()),
      ].join(","),
    );
  }

  return `${lines.join("\r\n")}\r\n`;
}

export function customersExportFilename(date = new Date()): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `customers-export-${y}-${mo}-${day}.csv`;
}
