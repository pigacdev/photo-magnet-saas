import type { Prisma } from "../../../src/generated/prisma/client";
import { prisma } from "./prisma";
import {
  enrichEvent,
  type EventStatus,
} from "./event";
import {
  eventStatusSortPriority,
  expandEventStatusFilterParams,
  isKnownEventStatusFilterToken,
} from "./eventListStatusFilter";

export type SellerEventListSortBy = "startDate" | "endDate" | "name" | "status";
export type SellerEventListSortOrder = "asc" | "desc";

export type SellerEventListQueryParams = {
  search: string;
  statusFilterTokens: string[];
  expandedStatusFilter: Set<EventStatus> | null;
  dateRange?: { gte?: Date; lte?: Date };
  sortBy: SellerEventListSortBy;
  sortOrder: SellerEventListSortOrder;
  page: number;
  pageSize: number;
};

export type SellerEventListParseError = {
  status: 400;
  error: string;
};

type ParsedQuery =
  | { ok: true; params: SellerEventListQueryParams }
  | { ok: false; error: SellerEventListParseError };

type EventListRow = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
  deletedAt: Date | null;
};

export type SellerEventListItemPayload = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isOpen: boolean;
  status: EventStatus;
  createdAt: string;
};

export type SellerEventListMappedRow = {
  row: EventListRow;
  payload: SellerEventListItemPayload;
};

function parsePositiveInt(value: unknown, fallback: number): number {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

function parseDateRange(query: Record<string, unknown>): {
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
): { ok: true; tokens: string[] } | { ok: false; error: SellerEventListParseError } {
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
    if (!isKnownEventStatusFilterToken(p)) {
      return { ok: false, error: { status: 400, error: `Invalid status: ${p}` } };
    }
    if (!seen.has(p)) {
      seen.add(p);
      tokens.push(p);
    }
  }
  return { ok: true, tokens };
}

export function parseSellerEventListQuery(
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

  const expandedStatusFilter =
    statusParsed.tokens.length > 0
      ? expandEventStatusFilterParams(statusParsed.tokens)
      : null;

  const dateRange = parseDateRange(query);

  const sortByParam =
    typeof query.sortBy === "string" ? query.sortBy.trim() : "";
  const sortBy: SellerEventListSortBy =
    sortByParam === "endDate"
      ? "endDate"
      : sortByParam === "name"
        ? "name"
        : sortByParam === "status"
          ? "status"
          : "startDate";

  const sortOrderRaw =
    typeof query.sortOrder === "string"
      ? query.sortOrder.trim().toLowerCase()
      : "";
  const sortOrder: SellerEventListSortOrder =
    sortOrderRaw === "asc" ? "asc" : "desc";

  return {
    ok: true,
    params: {
      search,
      statusFilterTokens: statusParsed.tokens,
      expandedStatusFilter,
      dateRange,
      sortBy,
      sortOrder,
      page,
      pageSize,
    },
  };
}

function mapEventRows(events: EventListRow[]): SellerEventListMappedRow[] {
  return events.map((e) => {
    const enriched = enrichEvent(e);
    return {
      row: e,
      payload: {
        id: e.id,
        name: e.name,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate.toISOString(),
        isActive: e.isActive,
        isOpen: enriched.isOpen,
        status: enriched.status,
        createdAt: e.createdAt.toISOString(),
      },
    };
  });
}

function sortSellerEventRows(
  rows: SellerEventListMappedRow[],
  sortBy: SellerEventListSortBy,
  sortOrder: SellerEventListSortOrder,
): SellerEventListMappedRow[] {
  const dir = sortOrder === "asc" ? 1 : -1;
  return [...rows].sort((x, y) => {
    if (sortBy === "name") {
      const cmp = x.row.name.localeCompare(y.row.name);
      if (cmp !== 0) return cmp * dir;
      return y.row.startDate.getTime() - x.row.startDate.getTime();
    }
    if (sortBy === "endDate") {
      const cmp = x.row.endDate.getTime() - y.row.endDate.getTime();
      if (cmp !== 0) return cmp * dir;
      return x.row.id.localeCompare(y.row.id);
    }
    if (sortBy === "status") {
      const pa = eventStatusSortPriority(x.payload.status);
      const pb = eventStatusSortPriority(y.payload.status);
      const cmp = pa - pb;
      if (cmp !== 0) return cmp * dir;
      return y.row.startDate.getTime() - x.row.startDate.getTime();
    }
    const cmp = x.row.startDate.getTime() - y.row.startDate.getTime();
    if (cmp !== 0) return cmp * dir;
    return x.row.id.localeCompare(y.row.id);
  });
}

export async function querySellerEvents(
  userId: string,
  params: Omit<
    SellerEventListQueryParams,
    "page" | "pageSize" | "statusFilterTokens"
  >,
): Promise<{ ok: true; rows: SellerEventListMappedRow[] }> {
  const where: Prisma.EventWhereInput = {
    userId,
    deletedAt: null,
  };

  if (params.search.length > 0) {
    where.OR = [
      { name: { contains: params.search, mode: "insensitive" } },
      { id: { contains: params.search, mode: "insensitive" } },
    ];
  }

  if (params.dateRange) {
    const overlap: Prisma.EventWhereInput = {};
    if (params.dateRange.lte) {
      overlap.startDate = { lte: params.dateRange.lte };
    }
    if (params.dateRange.gte) {
      overlap.endDate = { gte: params.dateRange.gte };
    }
    Object.assign(where, overlap);
  }

  const events = await prisma.event.findMany({
    where,
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      isActive: true,
      createdAt: true,
      deletedAt: true,
    },
  });

  let mapped = mapEventRows(events);

  if (params.expandedStatusFilter != null) {
    mapped = mapped.filter((x) =>
      params.expandedStatusFilter!.has(x.payload.status),
    );
  }

  const sorted = sortSellerEventRows(
    mapped,
    params.sortBy,
    params.sortOrder,
  );

  return { ok: true, rows: sorted };
}

export function paginateSellerEvents(
  rows: SellerEventListMappedRow[],
  page: number,
  pageSize: number,
): {
  pageSlice: SellerEventListMappedRow[];
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
