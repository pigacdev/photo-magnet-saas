import type { OrderStatus, Prisma } from "../../../src/generated/prisma/client";
import { computeOrderPrintProgress } from "../../../src/lib/orderPrintProgress";
import { prisma } from "./prisma";
import {
  expandStatusFilterParams,
  isKnownStatusFilterToken,
  orderStatusSortPriority,
} from "./orderListStatusFilter";
import {
  matchesPrintStatusFilter,
  parsePrintStatusFilter,
  type PrintStatusFilter,
} from "./orderListPrintFilter";

export type SellerOrderListSortBy = "createdAt" | "status" | "unprintedImages";
export type SellerOrderListSortOrder = "asc" | "desc";

export type SellerOrderListQueryParams = {
  search: string;
  statusFilterTokens: string[];
  expandedStatusFilter: Set<OrderStatus> | null;
  printStatusFilter: PrintStatusFilter | null;
  createdAt?: { gte?: Date; lte?: Date };
  contextType?: "EVENT" | "STOREFRONT";
  contextId?: string;
  sortBy: SellerOrderListSortBy;
  sortOrder: SellerOrderListSortOrder;
  page: number;
  pageSize: number;
};

export type SellerOrderListParseError = {
  status: 400;
  error: string;
};

type ParsedQuery =
  | { ok: true; params: SellerOrderListQueryParams }
  | { ok: false; error: SellerOrderListParseError };

type OrderListRow = {
  id: string;
  shortCode: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  status: OrderStatus;
  printedAt: Date | null;
  shippedAt: Date | null;
  contextType: "EVENT" | "STOREFRONT";
  contextId: string;
  totalPrice: Prisma.Decimal;
  currency: string;
  createdAt: Date;
  orderImages: { printed: boolean; mediaDeletedAt: Date | null }[];
};

export type SellerOrderListItemPayload = {
  id: string;
  shortCode: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  status: OrderStatus;
  contextType: "EVENT" | "STOREFRONT";
  contextId: string;
  totalPrice: string;
  currency: string;
  createdAt: string;
  imageCount: number;
  totalImages: number;
  printedImages: number;
  unprintedImages: number;
};

export type SellerOrderListMappedRow = {
  row: OrderListRow;
  payload: SellerOrderListItemPayload;
};

function parsePositiveInt(value: unknown, fallback: number): number {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

function parseCreatedAtRange(query: Record<string, unknown>): {
  gte?: Date;
  lte?: Date;
} | undefined {
  const dateFrom =
    typeof query.dateFrom === "string" ? query.dateFrom.trim() : "";
  const dateTo =
    typeof query.dateTo === "string" ? query.dateTo.trim() : "";
  const dateRange =
    typeof query.dateRange === "string" ? query.dateRange.trim() : "";

  if (dateFrom || dateTo) {
    const range: { gte?: Date; lte?: Date } = {};
    if (dateFrom) {
      const d = new Date(dateFrom);
      if (!Number.isNaN(d.getTime())) range.gte = d;
    }
    if (dateTo) {
      const d = new Date(dateTo);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        range.lte = d;
      }
    }
    if (range.gte || range.lte) return range;
    return undefined;
  }

  if (dateRange.includes(",")) {
    const [a, b] = dateRange.split(",").map((s) => s.trim());
    const start = a ? new Date(a) : null;
    const end = b ? new Date(b) : null;
    if (start && !Number.isNaN(start.getTime())) {
      const range: { gte?: Date; lte?: Date } = { gte: start };
      if (end && !Number.isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        range.lte = end;
      }
      return range;
    }
  }

  return undefined;
}

function parseStatusFilterTokens(
  query: Record<string, unknown>,
): { ok: true; tokens: string[] } | { ok: false; error: SellerOrderListParseError } {
  const statusRaw =
    typeof query.status === "string" ? query.status.trim().toLowerCase() : "";
  if (statusRaw.length === 0) {
    return { ok: true, tokens: [] };
  }

  const parts = statusRaw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const p of parts) {
    if (!isKnownStatusFilterToken(p)) {
      return { ok: false, error: { status: 400, error: `Invalid status: ${p}` } };
    }
    if (!seen.has(p)) {
      seen.add(p);
      tokens.push(p);
    }
  }
  return { ok: true, tokens };
}

/** Parse list/export query params (shared by GET /api/orders and export.csv). */
export function parseSellerOrderListQuery(
  query: Record<string, unknown>,
): ParsedQuery {
  const page = parsePositiveInt(query.page, 1);
  const pageSizeRaw = parsePositiveInt(query.pageSize, 20);
  const pageSize = Math.min(100, Math.max(1, pageSizeRaw));

  const search =
    typeof query.search === "string" ? query.search.trim() : "";

  const statusParsed = parseStatusFilterTokens(query);
  if (!statusParsed.ok) {
    return { ok: false, error: statusParsed.error };
  }

  const printStatusParsed = parsePrintStatusFilter(query);
  if (!printStatusParsed.ok) {
    return { ok: false, error: printStatusParsed.error };
  }

  const expandedStatusFilter =
    statusParsed.tokens.length > 0
      ? expandStatusFilterParams(statusParsed.tokens)
      : null;

  const createdAt = parseCreatedAtRange(query);

  const contextTypeQ =
    typeof query.contextType === "string"
      ? query.contextType.trim().toUpperCase()
      : "";
  const contextIdQ =
    typeof query.contextId === "string" ? query.contextId.trim() : "";

  if (contextTypeQ && !contextIdQ) {
    return {
      ok: false,
      error: {
        status: 400,
        error: "contextId is required when contextType is set",
      },
    };
  }
  if (contextIdQ && !contextTypeQ) {
    return {
      ok: false,
      error: {
        status: 400,
        error: "contextType is required when contextId is set",
      },
    };
  }

  let contextType: "EVENT" | "STOREFRONT" | undefined;
  let contextId: string | undefined;
  if (contextTypeQ && contextIdQ) {
    if (contextTypeQ !== "EVENT" && contextTypeQ !== "STOREFRONT") {
      return { ok: false, error: { status: 400, error: "Invalid contextType" } };
    }
    contextType = contextTypeQ;
    contextId = contextIdQ;
  }

  const sortByParam =
    typeof query.sortBy === "string" ? query.sortBy.trim() : "";
  const sortBy: SellerOrderListSortBy =
    sortByParam === "status"
      ? "status"
      : sortByParam === "unprintedImages"
        ? "unprintedImages"
        : "createdAt";
  const sortOrderRaw =
    typeof query.sortOrder === "string"
      ? query.sortOrder.trim().toLowerCase()
      : "";
  const sortOrder: SellerOrderListSortOrder =
    sortOrderRaw === "asc" ? "asc" : "desc";

  return {
    ok: true,
    params: {
      search,
      statusFilterTokens: statusParsed.tokens,
      expandedStatusFilter,
      printStatusFilter: printStatusParsed.filter,
      createdAt,
      contextType,
      contextId,
      sortBy,
      sortOrder,
      page,
      pageSize,
    },
  };
}

async function validateContextAccess(
  userId: string,
  contextType: "EVENT" | "STOREFRONT",
  contextId: string,
): Promise<SellerOrderListParseError | null> {
  if (contextType === "EVENT") {
    const ev = await prisma.event.findFirst({
      where: { id: contextId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!ev) {
      return { status: 400, error: "Unknown event or not accessible" };
    }
    return null;
  }

  const sf = await prisma.storefront.findFirst({
    where: { id: contextId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!sf) {
    return { status: 400, error: "Unknown storefront or not accessible" };
  }
  return null;
}

function mapOrderRows(orders: OrderListRow[]): SellerOrderListMappedRow[] {
  return orders.map((o) => {
    const progress = computeOrderPrintProgress(o.orderImages);
    return {
      row: o,
      payload: {
        id: o.id,
        shortCode: o.shortCode,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        customerPhone: o.customerPhone,
        status: o.status,
        contextType: o.contextType,
        contextId: o.contextId,
        totalPrice: o.totalPrice.toString(),
        currency: o.currency,
        createdAt: o.createdAt.toISOString(),
        imageCount: progress.totalImages,
        totalImages: progress.totalImages,
        printedImages: progress.printedImages,
        unprintedImages: progress.unprintedImages,
      },
    };
  });
}

function sortSellerOrderRows(
  rows: SellerOrderListMappedRow[],
  sortBy: SellerOrderListSortBy,
  sortOrder: SellerOrderListSortOrder,
): SellerOrderListMappedRow[] {
  return [...rows].sort((x, y) => {
    if (sortBy === "createdAt") {
      const ta = x.row.createdAt.getTime();
      const tb = y.row.createdAt.getTime();
      const cmp = sortOrder === "asc" ? ta - tb : tb - ta;
      if (cmp !== 0) return cmp;
      return x.row.id.localeCompare(y.row.id);
    }
    if (sortBy === "unprintedImages") {
      const ua = x.payload.unprintedImages;
      const ub = y.payload.unprintedImages;
      const cmp = sortOrder === "asc" ? ua - ub : ub - ua;
      if (cmp !== 0) return cmp;
      const ta = x.row.createdAt.getTime();
      const tb = y.row.createdAt.getTime();
      if (tb !== ta) return tb - ta;
      return x.row.id.localeCompare(y.row.id);
    }
    const pa = orderStatusSortPriority(x.row.status);
    const pb = orderStatusSortPriority(y.row.status);
    const cmp = sortOrder === "asc" ? pa - pb : pb - pa;
    if (cmp !== 0) return cmp;
    return y.row.createdAt.getTime() - x.row.createdAt.getTime();
  });
}

/** Fetch, filter, and sort seller orders (full result set, no pagination). */
export async function querySellerOrders(
  userId: string,
  params: Omit<
    SellerOrderListQueryParams,
    "page" | "pageSize" | "statusFilterTokens"
  >,
): Promise<
  | { ok: true; rows: SellerOrderListMappedRow[] }
  | { ok: false; error: SellerOrderListParseError }
> {
  if (params.contextType && params.contextId) {
    const ctxErr = await validateContextAccess(
      userId,
      params.contextType,
      params.contextId,
    );
    if (ctxErr) return { ok: false, error: ctxErr };
  }

  const where: Prisma.OrderWhereInput = {
    organizationId: userId,
    ...(params.createdAt ? { createdAt: params.createdAt } : {}),
    ...(params.contextType && params.contextId
      ? { contextType: params.contextType, contextId: params.contextId }
      : {}),
  };

  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      shortCode: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      status: true,
      printedAt: true,
      shippedAt: true,
      contextType: true,
      contextId: true,
      totalPrice: true,
      currency: true,
      createdAt: true,
      orderImages: {
        select: { printed: true, mediaDeletedAt: true },
      },
    },
  });

  let filtered = orders;

  if (params.search.length > 0) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        (o.shortCode?.toLowerCase().includes(q) ?? false) ||
        (o.customerName?.toLowerCase().includes(q) ?? false) ||
        (o.customerEmail?.toLowerCase().includes(q) ?? false) ||
        (o.customerPhone?.toLowerCase().includes(q) ?? false),
    );
  }

  const mapped = mapOrderRows(filtered);

  const printFiltered =
    params.printStatusFilter != null
      ? mapped.filter((x) =>
          matchesPrintStatusFilter(
            params.printStatusFilter,
            x.row.status,
            x.row.orderImages,
          ),
        )
      : mapped;

  const statusFiltered =
    params.expandedStatusFilter != null
      ? printFiltered.filter((x) =>
          params.expandedStatusFilter!.has(x.row.status),
        )
      : printFiltered;

  const sortedList = sortSellerOrderRows(
    statusFiltered,
    params.sortBy,
    params.sortOrder,
  );

  return { ok: true, rows: sortedList };
}

export function paginateSellerOrders(
  rows: SellerOrderListMappedRow[],
  page: number,
  pageSize: number,
): {
  pageSlice: SellerOrderListMappedRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
} {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * pageSize;
  const pageSlice = rows.slice(skip, skip + pageSize);

  return {
    pageSlice,
    pagination: {
      page: safePage,
      pageSize,
      total,
      totalPages,
    },
  };
}
