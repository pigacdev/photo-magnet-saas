import {
  orderIsFullyPrinted,
  orderNeedsPrintingAttention,
  type OrderImagePrintRow,
} from "../../../src/lib/orderPrintProgress";

export type PrintStatusFilter = "needs_printing" | "fully_printed";

const PRINT_STATUS_FILTER_TOKENS = new Set<string>([
  "needs_printing",
  "fully_printed",
]);

export function isKnownPrintStatusFilterToken(token: string): boolean {
  return PRINT_STATUS_FILTER_TOKENS.has(token.trim().toLowerCase());
}

export function parsePrintStatusFilter(
  query: Record<string, unknown>,
):
  | { ok: true; filter: PrintStatusFilter | null }
  | { ok: false; error: { status: 400; error: string } } {
  const raw =
    typeof query.printStatus === "string" ? query.printStatus.trim().toLowerCase() : "";
  if (raw.length === 0) {
    return { ok: true, filter: null };
  }
  if (!isKnownPrintStatusFilterToken(raw)) {
    return {
      ok: false,
      error: { status: 400, error: `Invalid printStatus: ${raw}` },
    };
  }
  return { ok: true, filter: raw as PrintStatusFilter };
}

export function matchesPrintStatusFilter(
  filter: PrintStatusFilter | null,
  status: string,
  images: OrderImagePrintRow[],
): boolean {
  if (filter == null) return true;
  if (filter === "needs_printing") {
    return orderNeedsPrintingAttention(status, images);
  }
  return orderIsFullyPrinted(images);
}
