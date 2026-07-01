import { SETTLED_ORDER_STATUSES } from "./orderSettlement";

export type CustomerListSortBy =
  | "name"
  | "createdAt"
  | "orderCount"
  | "totalSpent";

export type CustomerListParams = {
  search: string;
  page: number;
  pageSize: number;
  sortBy: CustomerListSortBy;
  sortOrder: "asc" | "desc";
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export function parseCustomerListQuery(
  query: Record<string, unknown>,
):
  | { ok: true; params: CustomerListParams }
  | { ok: false; error: { status: number; error: string } } {
  const search =
    typeof query.search === "string" ? query.search.trim() : "";

  let page = 1;
  if (query.page !== undefined) {
    const n = Number(query.page);
    if (!Number.isInteger(n) || n < 1) {
      return { ok: false, error: { status: 400, error: "Invalid page" } };
    }
    page = n;
  }

  let pageSize = DEFAULT_PAGE_SIZE;
  if (query.pageSize !== undefined) {
    const n = Number(query.pageSize);
    if (!Number.isInteger(n) || n < 1 || n > MAX_PAGE_SIZE) {
      return {
        ok: false,
        error: { status: 400, error: "Invalid pageSize" },
      };
    }
    pageSize = n;
  }

  const sortByRaw =
    typeof query.sortBy === "string" ? query.sortBy.trim() : "createdAt";
  const sortBy: CustomerListSortBy = [
    "name",
    "createdAt",
    "orderCount",
    "totalSpent",
  ].includes(sortByRaw)
    ? (sortByRaw as CustomerListSortBy)
    : "createdAt";

  const sortOrderRaw =
    typeof query.sortOrder === "string" ? query.sortOrder.trim() : "desc";
  const sortOrder: "asc" | "desc" =
    sortOrderRaw === "asc" || sortOrderRaw === "desc" ? sortOrderRaw : "desc";

  return {
    ok: true,
    params: { search, page, pageSize, sortBy, sortOrder },
  };
}

export function customerSearchWhere(
  organizationId: string,
  search: string,
): {
  organizationId: string;
  deletedAt: null;
  OR?: Array<{
    name?: { contains: string; mode: "insensitive" };
    email?: { contains: string; mode: "insensitive" };
    phone?: { contains: string; mode: "insensitive" };
  }>;
} {
  const base = { organizationId, deletedAt: null as null };
  if (!search) return base;
  return {
    ...base,
    OR: [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ],
  };
}

export { SETTLED_ORDER_STATUSES };
