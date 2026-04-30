"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import type { OrderDisplayStatus } from "@/lib/orderDisplayStatus";

export type SellerOrderListItem = {
  id: string;
  shortCode: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  status: string;
  displayStatus: OrderDisplayStatus;
  contextType: "EVENT" | "STOREFRONT";
  totalPrice: string;
  currency: string;
  createdAt: string;
  imageCount: number;
  totalImages: number;
  printedImages: number;
};

type OrdersListResponse = {
  items: SellerOrderListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type OrderContextsResponse = {
  events: { id: string; name: string }[];
  storefronts: { id: string; name: string }[];
};

function startOfTodayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfTodayLocal(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeekMondayLocal(from: Date): Date {
  const d = new Date(from);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeekSundayLocal(from: Date): Date {
  const mon = startOfWeekMondayLocal(from);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return sun;
}

function startOfMonthLocal(from: Date): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonthLocal(from: Date): Date {
  const d = new Date(from.getFullYear(), from.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function datesMatchPreset(
  urlFrom: string | null,
  urlTo: string | null,
  start: Date,
  end: Date,
): boolean {
  if (!urlFrom || !urlTo) return false;
  return urlFrom === start.toISOString() && urlTo === end.toISOString();
}

/** Parse YYYY-MM-DD as local calendar day start (00:00:00.000). */
function startOfLocalDayFromYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(y, mo, day, 0, 0, 0, 0);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== day) {
    return null;
  }
  return d;
}

/** Local end of day (23:59:59.999) for a YYYY-MM-DD. */
function endOfLocalDayFromYmd(ymd: string): Date | null {
  const s = startOfLocalDayFromYmd(ymd);
  if (!s) return null;
  const e = new Date(s);
  e.setHours(23, 59, 59, 999);
  return e;
}

/** Map URL ISO param to value for `<input type="date" />` (local YYYY-MM-DD). */
function isoToDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function orderCodeLabel(o: SellerOrderListItem): string {
  return o.shortCode ?? o.id.slice(0, 8);
}

const SELLER_LIST_STATUS_OPTIONS = [
  { value: "awaiting_payment", label: "Awaiting payment" },
  { value: "ready", label: "Ready to print" },
  { value: "partial", label: "Partially printed" },
  { value: "printed", label: "Printed" },
  { value: "shipped", label: "Shipped" },
] as const;

type SellerListStatusValue = (typeof SELLER_LIST_STATUS_OPTIONS)[number]["value"];

function parseStatusSelectionsFromParam(
  param: string | null,
): SellerListStatusValue[] {
  if (!param?.trim()) return [];
  const out: SellerListStatusValue[] = [];
  const seen = new Set<string>();
  for (const raw of param.split(",")) {
    const s = raw.trim().toLowerCase();
    if (!s || seen.has(s)) continue;
    const opt = SELLER_LIST_STATUS_OPTIONS.find((o) => o.value === s);
    if (!opt) continue;
    seen.add(s);
    out.push(opt.value);
  }
  return out;
}

function statusParamFromSelections(selected: SellerListStatusValue[]): string {
  const set = new Set(selected);
  return SELLER_LIST_STATUS_OPTIONS.map((o) => o.value)
    .filter((v) => set.has(v))
    .join(",");
}

function OrderCustomerCell({ o }: { o: SellerOrderListItem }) {
  return (
    <div className="space-y-1">
      <p className="font-medium text-[#111111]">
        {o.customerName?.trim() ? o.customerName : "Guest"}
      </p>
      {o.customerEmail?.trim() ? (
        <p className="text-xs text-gray-500">{o.customerEmail}</p>
      ) : null}
      {o.customerPhone?.trim() ? (
        <p className="text-xs text-gray-500">{o.customerPhone}</p>
      ) : null}
    </div>
  );
}

function OrderPrintStatus({
  totalImages,
  printedImages,
  displayStatus,
}: {
  totalImages: number;
  printedImages: number;
  displayStatus: OrderDisplayStatus;
}) {
  const total = totalImages;
  const printed = printedImages;

  let statusLabel: string;
  let statusClass: string;

  if (displayStatus === "SHIPPED") {
    statusLabel = "Shipped";
    statusClass = "text-blue-600";
  } else if (displayStatus === "AWAITING_PAYMENT") {
    statusLabel = "Awaiting payment";
    statusClass = "text-gray-500";
  } else if (displayStatus === "READY_TO_PRINT") {
    if (printed === 0) {
      statusLabel = "Ready to print";
      statusClass = "text-gray-500";
    } else if (printed < total) {
      statusLabel = "Partially printed";
      statusClass = "text-orange-600";
    } else {
      statusLabel = "Printed";
      statusClass = "text-green-600";
    }
  } else if (displayStatus === "PRINTED") {
    if (printed < total) {
      statusLabel = "Partially printed";
      statusClass = "text-orange-600";
    } else {
      statusLabel = "Printed";
      statusClass = "text-green-600";
    }
  } else {
    statusLabel = "—";
    statusClass = "text-gray-500";
  }

  return (
    <span className={`text-sm ${statusClass}`}>{statusLabel}</span>
  );
}

function OrdersListContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<SellerOrderListItem[]>([]);
  const [pagination, setPagination] = useState<OrdersListResponse["pagination"]>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contexts, setContexts] = useState<OrderContextsResponse | null>(null);
  const [contextsLoading, setContextsLoading] = useState(true);

  const searchFromUrl = searchParams.get("search") ?? "";
  const [searchDraft, setSearchDraft] = useState(searchFromUrl);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detailsRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!detailsRef.current) return;

      if (!detailsRef.current.contains(event.target as Node)) {
        detailsRef.current.removeAttribute("open");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    setSearchDraft(searchFromUrl);
  }, [searchFromUrl]);

  const replaceQuery = useCallback(
    (mutate: (q: URLSearchParams) => void) => {
      const q = new URLSearchParams(searchParams.toString());
      mutate(q);
      const s = q.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    setContextsLoading(true);
    api<OrderContextsResponse>("/api/orders/contexts")
      .then((data) => setContexts(data))
      .catch(() => setContexts({ events: [], storefronts: [] }))
      .finally(() => setContextsLoading(false));
  }, []);

  const contextTypeParam = searchParams.get("contextType");
  const contextIdParam = searchParams.get("contextId");
  const contextSelectValue =
    contextTypeParam &&
    contextIdParam &&
    (contextTypeParam === "EVENT" || contextTypeParam === "STOREFRONT")
      ? `${contextTypeParam}:${contextIdParam}`
      : "";

  const selectedContextSummary = useMemo(() => {
    if (!contextTypeParam || !contextIdParam || !contexts) return null;
    if (contextTypeParam === "EVENT") {
      const e = contexts.events.find((x) => x.id === contextIdParam);
      return e ? { label: "Event", name: e.name } : null;
    }
    if (contextTypeParam === "STOREFRONT") {
      const s = contexts.storefronts.find((x) => x.id === contextIdParam);
      return s ? { label: "Storefront", name: s.name } : null;
    }
    return null;
  }, [contextIdParam, contextTypeParam, contexts]);

  const datePresetActive = useMemo(() => {
    const now = new Date();
    const df = searchParams.get("dateFrom");
    const dt = searchParams.get("dateTo");
    return {
      today: datesMatchPreset(
        df,
        dt,
        startOfTodayLocal(),
        endOfTodayLocal(),
      ),
      week: datesMatchPreset(
        df,
        dt,
        startOfWeekMondayLocal(now),
        endOfWeekSundayLocal(now),
      ),
      month: datesMatchPreset(
        df,
        dt,
        startOfMonthLocal(now),
        endOfMonthLocal(now),
      ),
    };
  }, [searchParams]);

  function applyDatePreset(preset: "today" | "week" | "month") {
    const now = new Date();
    let start: Date;
    let end: Date;
    if (preset === "today") {
      start = startOfTodayLocal();
      end = endOfTodayLocal();
    } else if (preset === "week") {
      start = startOfWeekMondayLocal(now);
      end = endOfWeekSundayLocal(now);
    } else {
      start = startOfMonthLocal(now);
      end = endOfMonthLocal(now);
    }
    replaceQuery((q) => {
      q.set("dateFrom", start.toISOString());
      q.set("dateTo", end.toISOString());
      q.delete("dateRange");
      q.set("page", "1");
    });
  }

  function clearDateFilters() {
    replaceQuery((q) => {
      q.delete("dateFrom");
      q.delete("dateTo");
      q.delete("dateRange");
      q.set("page", "1");
    });
  }

  const fromDateValue = isoToDateInputValue(searchParams.get("dateFrom"));
  const toDateValue = isoToDateInputValue(searchParams.get("dateTo"));

  function updateDateFilter(which: "from" | "to", ymd: string) {
    replaceQuery((q) => {
      q.delete("dateRange");
      q.set("page", "1");

      if (which === "from") {
        if (!ymd) {
          q.delete("dateFrom");
          q.delete("dateTo");
          return;
        }
        const start = startOfLocalDayFromYmd(ymd);
        if (!start) return;
        q.set("dateFrom", start.toISOString());

        const hadTo = Boolean(searchParams.get("dateTo"));
        if (!hadTo) {
          const end = endOfLocalDayFromYmd(ymd);
          if (end) q.set("dateTo", end.toISOString());
        }
        return;
      }

      if (!ymd) {
        q.delete("dateTo");
        return;
      }
      const end = endOfLocalDayFromYmd(ymd);
      if (end) q.set("dateTo", end.toISOString());
    });
  }

  useEffect(() => {
    if (searchDraft === searchFromUrl) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      searchDebounceRef.current = null;
      replaceQuery((q) => {
        const t = searchDraft.trim();
        if (t) q.set("search", t);
        else q.delete("search");
        q.set("page", "1");
      });
    }, 400);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchDraft, searchFromUrl, replaceQuery]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const qs = searchParams.toString();
    const url = qs ? `/api/orders?${qs}` : "/api/orders";
    api<OrdersListResponse>(url)
      .then((data) => {
        setOrders(data.items);
        setPagination(data.pagination);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [searchParams]);

  function formatMoney(amount: string, currency: string) {
    const n = Number(amount);
    if (Number.isNaN(n)) return amount;
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "EUR",
    }).format(n);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  const hasFilters =
    Boolean(searchParams.get("search")?.trim()) ||
    Boolean(searchParams.get("status")?.trim()) ||
    Boolean(searchParams.get("dateFrom")) ||
    Boolean(searchParams.get("dateTo")) ||
    Boolean(
      searchParams.get("contextType")?.trim() &&
        searchParams.get("contextId")?.trim(),
    );

  const page = pagination.page;
  const totalPages = pagination.totalPages;
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const hasDateInUrl =
    Boolean(searchParams.get("dateFrom")) ||
    Boolean(searchParams.get("dateTo"));

  const sortByParam = searchParams.get("sortBy");
  const sortOrderCol =
    searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

  const selectedStatuses = useMemo(
    () => parseStatusSelectionsFromParam(searchParams.get("status")),
    [searchParams],
  );

  function toggleSort(column: "createdAt" | "status") {
    replaceQuery((q) => {
      const prevBy = q.get("sortBy") === "status" ? "status" : "createdAt";
      const prevOrder = q.get("sortOrder") === "asc" ? "asc" : "desc";
      if (column !== prevBy) {
        q.set("sortBy", column);
        q.set("sortOrder", "desc");
      } else {
        q.set("sortBy", column);
        q.set("sortOrder", prevOrder === "asc" ? "desc" : "asc");
      }
      q.set("page", "1");
    });
  }

  const quickBtn =
    "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors";
  const quickBtnIdle = `${quickBtn} border-gray-300 bg-white text-[#111111] hover:bg-[#F9FAFB]`;
  const quickBtnActive = `${quickBtn} border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]`;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
          Orders
        </h1>
        <p className="mt-2 text-[#6B7280]">
          Read-only list of orders from your events and storefronts.
        </p>
        {selectedContextSummary ? (
          <p className="mt-2 text-sm text-[#2563EB]">
            Showing orders for{" "}
            <span className="font-medium">{selectedContextSummary.label}</span>
            : {selectedContextSummary.name}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[#6B7280]">Context</span>
        <select
          value={contextSelectValue}
          disabled={contextsLoading}
          onChange={(e) => {
            const v = e.target.value;
            replaceQuery((q) => {
              if (!v) {
                q.delete("contextType");
                q.delete("contextId");
              } else {
                const idx = v.indexOf(":");
                if (idx === -1) return;
                const t = v.slice(0, idx);
                const id = v.slice(idx + 1);
                q.set("contextType", t);
                q.set("contextId", id);
              }
              q.set("page", "1");
            });
          }}
          className="w-full max-w-md min-h-11 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#111111] outline-none ring-[#2563EB] focus:ring-2 disabled:cursor-wait disabled:opacity-60 sm:min-w-[280px]"
          aria-label="Filter orders by event or storefront"
        >
          <option value="">
            {contextsLoading ? "All contexts (loading…)" : "All contexts"}
          </option>
          {contexts && contexts.events.length > 0 ? (
            <optgroup label="Events">
              {contexts.events.map((ev) => (
                <option key={ev.id} value={`EVENT:${ev.id}`}>
                  {ev.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {contexts && contexts.storefronts.length > 0 ? (
            <optgroup label="Storefronts">
              {contexts.storefronts.map((sf) => (
                <option key={sf.id} value={`STOREFRONT:${sf.id}`}>
                  {sf.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
        {!contextsLoading && !selectedContextSummary && contexts ? (
          <p className="text-xs text-[#9CA3AF]">
            All events and storefronts — use the menu to narrow the list.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-[#6B7280]">Date</span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyDatePreset("today")}
            className={datePresetActive.today ? quickBtnActive : quickBtnIdle}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => applyDatePreset("week")}
            className={datePresetActive.week ? quickBtnActive : quickBtnIdle}
          >
            This week
          </button>
          <button
            type="button"
            onClick={() => applyDatePreset("month")}
            className={datePresetActive.month ? quickBtnActive : quickBtnIdle}
          >
            This month
          </button>
          <button
            type="button"
            onClick={() => clearDateFilters()}
            disabled={!hasDateInUrl}
            className={`${quickBtn} border-gray-300 bg-white text-[#111111] hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40`}
          >
            Clear
          </button>
          <span className="hidden sm:inline-block sm:w-px sm:self-stretch sm:bg-gray-200 sm:mx-1" aria-hidden />
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-[#6B7280]">
              From
            </span>
            <input
              type="date"
              value={fromDateValue}
              onChange={(e) =>
                updateDateFilter("from", e.target.value)
              }
              className="h-9 w-[140px] rounded-lg border border-gray-200 px-2 text-sm text-[#111111] outline-none ring-[#2563EB] focus:ring-2"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-[#6B7280]">
              To
            </span>
            <input
              type="date"
              value={toDateValue}
              onChange={(e) =>
                updateDateFilter("to", e.target.value)
              }
              className="h-9 w-[140px] rounded-lg border border-gray-200 px-2 text-sm text-[#111111] outline-none ring-[#2563EB] focus:ring-2"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium text-[#6B7280]">Search</span>
          <input
            type="search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search by order ID, customer name, email, or phone"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#111111] outline-none ring-[#2563EB] focus:ring-2"
          />
        </label>
        <div className="relative flex w-full min-w-[200px] flex-col gap-1.5 sm:w-56">
          <span className="text-xs font-medium text-[#6B7280]">Status</span>
          <details ref={detailsRef} className="group relative">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#111111] outline-none ring-[#2563EB] marker:hidden focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 truncate">
                <span className="font-medium text-[#6B7280]">Showing:</span>{" "}
                {selectedStatuses.length === 0
                  ? "All"
                  : selectedStatuses
                      .map(
                        (v) =>
                          SELLER_LIST_STATUS_OPTIONS.find((o) => o.value === v)
                            ?.label ?? v,
                      )
                      .join(", ")}
              </span>
              <span
                className="shrink-0 text-[#9CA3AF] transition-transform group-open:rotate-180"
                aria-hidden
              >
                ▾
              </span>
            </summary>
            <div className="absolute left-0 right-0 z-20 mt-1 rounded-lg border border-gray-200 bg-white py-2 shadow-lg">
              <div className="border-b border-gray-100 px-3 pb-2">
                <button
                  type="button"
                  className="text-sm font-medium text-[#2563EB] hover:underline"
                  onClick={() => {
                    replaceQuery((q) => {
                      q.delete("status");
                      q.set("page", "1");
                    });
                  }}
                >
                  All statuses
                </button>
              </div>
              <ul className="max-h-64 overflow-auto px-2 pt-2">
                {SELLER_LIST_STATUS_OPTIONS.map((opt) => {
                  const checked = selectedStatuses.includes(opt.value);
                  return (
                    <li key={opt.value}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-[#111111] hover:bg-[#F9FAFB]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const set = new Set(selectedStatuses);
                            if (set.has(opt.value)) set.delete(opt.value);
                            else set.add(opt.value);
                            const next = SELLER_LIST_STATUS_OPTIONS.map(
                              (o) => o.value,
                            ).filter((v) => set.has(v));
                            replaceQuery((q) => {
                              const param = statusParamFromSelections(next);
                              if (param) q.set("status", param);
                              else q.delete("status");
                              q.set("page", "1");
                            });
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB]"
                        />
                        {opt.label}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          </details>
        </div>
        <label className="flex w-full min-w-[120px] flex-col gap-1.5 sm:w-32">
          <span className="text-xs font-medium text-[#6B7280]">Page size</span>
          <select
            value={searchParams.get("pageSize") ?? String(pagination.pageSize)}
            onChange={(e) => {
              const pageSize = e.target.value;
              replaceQuery((q) => {
                q.set("pageSize", pageSize);
                q.set("page", "1");
              });
            }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#111111] outline-none ring-[#2563EB] focus:ring-2"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-[#6B7280]">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <>
          {orders.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[#6B7280]">
                {hasFilters ? "No matching orders." : "No orders yet."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto rounded-lg border border-gray-200 md:block">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="border-b border-gray-200 bg-[#F9FAFB] text-[#6B7280]">
                    <tr>
                      <th className="px-4 py-3 font-medium">Code</th>
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="px-4 py-3 font-medium">
                        <button
                          type="button"
                          className="inline-flex items-center gap-0.5 hover:text-[#111111]"
                          onClick={() => toggleSort("status")}
                        >
                          Status
                          {sortByParam === "status"
                            ? sortOrderCol === "asc"
                              ? " ↑"
                              : " ↓"
                            : null}
                        </button>
                      </th>
                      <th className="px-4 py-3 font-medium">
                        <button
                          type="button"
                          className="inline-flex items-center gap-0.5 hover:text-[#111111]"
                          onClick={() => toggleSort("createdAt")}
                        >
                          Created
                          {sortByParam !== "status"
                            ? sortOrderCol === "asc"
                              ? " ↑"
                              : " ↓"
                            : null}
                        </button>
                      </th>
                      <th className="px-4 py-3 font-medium">Images</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr
                        key={o.id}
                        role="link"
                        tabIndex={0}
                        className="cursor-pointer border-b border-gray-100 transition-colors last:border-0 hover:bg-[#F9FAFB]"
                        onClick={() => router.push(`/dashboard/orders/${o.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            router.push(`/dashboard/orders/${o.id}`);
                        }}
                      >
                        <td className="px-4 py-3 font-medium text-[#111111]">
                          {orderCodeLabel(o)}
                        </td>
                        <td className="max-w-[220px] px-4 py-3">
                          <OrderCustomerCell o={o} />
                        </td>
                        <td className="px-4 py-3">
                          <OrderPrintStatus
                            totalImages={o.totalImages}
                            printedImages={o.printedImages}
                            displayStatus={o.displayStatus}
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[#6B7280]">
                          {formatDate(o.createdAt)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-[#111111]">
                          {o.imageCount}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/orders/${o.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-[#2563EB] hover:underline"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="flex flex-col gap-3 md:hidden">
                {orders.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/dashboard/orders/${o.id}`}
                      className="block rounded-lg border border-gray-200 p-4 transition-colors active:bg-[#F9FAFB]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-[#111111]">
                          {orderCodeLabel(o)}
                        </span>
                        <OrderPrintStatus
                          totalImages={o.totalImages}
                          printedImages={o.printedImages}
                          displayStatus={o.displayStatus}
                        />
                      </div>
                      <div className="mt-3">
                        <OrderCustomerCell o={o} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-[#6B7280]">Created</p>
                          <p className="text-[#6B7280]">
                            {formatDate(o.createdAt)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#6B7280]">Images</p>
                          <p className="tabular-nums text-[#111111]">
                            {o.imageCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#6B7280]">Type</p>
                          <p className="text-[#111111]">{o.contextType}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#6B7280]">Total</p>
                          <p className="font-medium text-[#111111]">
                            {formatMoney(o.totalPrice, o.currency)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 pt-4 sm:flex-row">
            <p className="text-sm text-[#6B7280]">
              Page {page} of {totalPages}
              <span className="text-[#9CA3AF]">
                {" "}
                ({pagination.total} total)
              </span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!canPrev || loading}
                onClick={() =>
                  replaceQuery((q) => {
                    q.set("page", String(Math.max(1, page - 1)));
                  })
                }
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!canNext || loading}
                onClick={() =>
                  replaceQuery((q) => {
                    q.set("page", String(Math.min(totalPages, page + 1)));
                  })
                }
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function OrdersListPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-8">
          <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
            Orders
          </h1>
          <p className="text-sm text-[#6B7280]">Loading…</p>
        </div>
      }
    >
      <OrdersListContent />
    </Suspense>
  );
}
