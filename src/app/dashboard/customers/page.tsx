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
import { api, apiDownload } from "@/lib/api";
import {
  getCachedOrganizationUsage,
  getMe,
  subscribeOrganizationUsage,
} from "@/lib/auth";
import { formatDisplayDateTime } from "@/lib/dateFormat";
import { usageHasFeature } from "@/lib/planFeatures";
import { CustomerDetailModal } from "@/components/dashboard/CustomerDetailModal";
import type { CustomerDetailOrder } from "@/components/dashboard/CustomerDetailModal";
import { CustomerContactEditModal } from "@/components/dashboard/CustomerContactEditModal";
import { CustomerDeleteConfirmModal } from "@/components/dashboard/CustomerDeleteConfirmModal";

type CustomerListItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  orderCount: number;
  totalSpent: string;
  currency: string;
  customerSince: string;
};

type CustomersListResponse = {
  items: CustomerListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  stats: {
    totalCustomers: number;
    newCustomersThisMonth: number;
  };
};

type CustomerDetailResponse = {
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    customerSince: string;
  };
  orders: CustomerDetailOrder[];
};

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

function formatMoney(amount: string, currency: string): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return amount;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.trim() || "EUR",
  }).format(n);
}

function ContactCell({ item }: { item: CustomerListItem }) {
  return (
    <div className="space-y-1">
      {item.email?.trim() ? (
        <p className="text-sm text-foreground">{item.email}</p>
      ) : null}
      {item.phone?.trim() ? (
        <p className="text-xs text-muted-foreground">{item.phone}</p>
      ) : null}
      {!item.email?.trim() && !item.phone?.trim() ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : null}
    </div>
  );
}

function CustomersPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<CustomerListItem[]>([]);
  const [pagination, setPagination] = useState<
    CustomersListResponse["pagination"]
  >({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [stats, setStats] = useState<CustomersListResponse["stats"]>({
    totalCustomers: 0,
    newCustomersThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [usage, setUsage] = useState(() => getCachedOrganizationUsage());

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailCustomer, setDetailCustomer] =
    useState<CustomerDetailResponse["customer"] | null>(null);
  const [detailOrders, setDetailOrders] = useState<CustomerDetailOrder[]>([]);

  const [editCustomer, setEditCustomer] = useState<CustomerListItem | null>(
    null,
  );
  const [deleteCustomer, setDeleteCustomer] = useState<CustomerListItem | null>(
    null,
  );
  const [deleteSaving, setDeleteSaving] = useState(false);

  useEffect(() => {
    void getMe().then(() => setUsage(getCachedOrganizationUsage()));
    return subscribeOrganizationUsage(() => {
      setUsage(getCachedOrganizationUsage());
    });
  }, []);

  const canCustomers = usageHasFeature(usage, "customers");

  const searchFromUrl = searchParams.get("search") ?? "";
  const [searchDraft, setSearchDraft] = useState(searchFromUrl);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const listQueryString = useMemo(() => {
    const q = new URLSearchParams(searchParams.toString());
    return q.toString();
  }, [searchParams]);

  const loadList = useCallback(() => {
    if (!canCustomers) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const path = listQueryString
      ? `/api/customers?${listQueryString}`
      : "/api/customers";
    api<CustomersListResponse>(path)
      .then((data) => {
        setItems(data.items);
        setPagination(data.pagination);
        setStats(data.stats);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Could not load customers");
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, [canCustomers, listQueryString]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openDetail = useCallback(async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailCustomer(null);
    setDetailOrders([]);
    try {
      const data = await api<CustomerDetailResponse>(
        `/api/customers/${encodeURIComponent(id)}`,
      );
      setDetailCustomer(data.customer);
      setDetailOrders(data.orders);
    } catch {
      setDetailCustomer(null);
      setDetailOrders([]);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  async function handleDeleteConfirm() {
    if (!deleteCustomer) return;
    setDeleteSaving(true);
    try {
      await api<{ ok: boolean }>(
        `/api/customers/${encodeURIComponent(deleteCustomer.id)}`,
        { method: "DELETE" },
      );
      setDeleteCustomer(null);
      loadList();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not delete customer",
      );
    } finally {
      setDeleteSaving(false);
    }
  }

  async function handleExport() {
    setExportLoading(true);
    setExportError(null);
    try {
      const search = searchParams.get("search") ?? "";
      const path = search
        ? `/api/customers/export.csv?search=${encodeURIComponent(search)}`
        : "/api/customers/export.csv";
      const { blob, filename } = await apiDownload(path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? "customers-export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(
        e instanceof Error ? e.message : "Could not export customers.",
      );
    } finally {
      setExportLoading(false);
    }
  }

  if (!canCustomers) {
    return (
      <div className="dashboard-page mx-auto max-w-lg">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Customers
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Customer management is available on the Pro plan. Upgrade to view and
          manage your buyers in one place.
        </p>
        <Link
          href="/dashboard/billing"
          className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          View plans
        </Link>
      </div>
    );
  }

  const page = pagination.page;
  const totalPages = pagination.totalPages;

  return (
    <div className="dashboard-page flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Customers
        </h1>
        <button
          type="button"
          disabled={loading || exportLoading}
          onClick={() => void handleExport()}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-50"
        >
          {exportLoading ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      {exportError ? (
        <p className="text-sm text-red-600">{exportError}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard
          label="Total customers"
          value={String(stats.totalCustomers)}
        />
        <KpiCard
          label="New customers this month"
          value={String(stats.newCustomersThisMonth)}
        />
      </div>

      <div>
        <label className="sr-only" htmlFor="customer-search">
          Search customers
        </label>
        <input
          id="customer-search"
          type="search"
          placeholder="Search by name, email, or phone…"
          value={searchDraft}
          onChange={(e) => {
            const value = e.target.value;
            setSearchDraft(value);
            if (searchDebounceRef.current) {
              clearTimeout(searchDebounceRef.current);
            }
            searchDebounceRef.current = setTimeout(() => {
              replaceQuery((q) => {
                if (value.trim()) q.set("search", value.trim());
                else q.delete("search");
                q.delete("page");
              });
            }, 400);
          }}
          className="w-full max-w-md rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-primary focus:ring-2"
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {searchFromUrl
            ? "No customers match your search."
            : "No customers yet. They appear here after buyers complete an order."}
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border bg-surface/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3 text-right">Orders</th>
                  <th className="px-4 py-3 text-right">Total spent</th>
                  <th className="px-4 py-3">Customer since</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer hover:bg-surface/40"
                    onClick={() => void openDetail(item.id)}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {item.name}
                    </td>
                    <td className="px-4 py-3">
                      <ContactCell item={item} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {item.orderCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatMoney(item.totalSpent, item.currency)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDisplayDateTime(item.customerSince)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-blue-50 dark:hover:bg-blue-950/40"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditCustomer(item);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteCustomer(item);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-3 md:hidden">
            {items.map((item) => (
              <li
                key={item.id}
                className="cursor-pointer rounded-lg border border-border bg-card p-4 shadow-sm"
                onClick={() => void openDetail(item.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{item.name}</p>
                    <ContactCell item={item} />
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-xs font-medium text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditCustomer(item);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-xs font-medium text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteCustomer(item);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Orders</dt>
                    <dd className="font-medium tabular-nums">{item.orderCount}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Total spent</dt>
                    <dd className="font-medium tabular-nums">
                      {formatMoney(item.totalSpent, item.currency)}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Customer since</dt>
                    <dd>{formatDisplayDateTime(item.customerSince)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="text-muted-foreground">
                Page {page} of {totalPages} ({pagination.total} customers)
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() =>
                    replaceQuery((q) => {
                      q.set("page", String(page - 1));
                    })
                  }
                  className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() =>
                    replaceQuery((q) => {
                      q.set("page", String(page + 1));
                    })
                  }
                  className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <CustomerDetailModal
        open={detailOpen}
        loading={detailLoading}
        customer={detailCustomer}
        orders={detailOrders}
        onClose={() => setDetailOpen(false)}
      />

      {editCustomer ? (
        <CustomerContactEditModal
          open
          customer={{
            id: editCustomer.id,
            name: editCustomer.name,
            email: editCustomer.email,
            phone: editCustomer.phone,
          }}
          onClose={() => setEditCustomer(null)}
          onSaved={loadList}
        />
      ) : null}

      <CustomerDeleteConfirmModal
        open={Boolean(deleteCustomer)}
        customerName={deleteCustomer?.name ?? ""}
        saving={deleteSaving}
        onClose={() => {
          if (!deleteSaving) setDeleteCustomer(null);
        }}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Loading customers…</p>
      }
    >
      <CustomersPageContent />
    </Suspense>
  );
}
