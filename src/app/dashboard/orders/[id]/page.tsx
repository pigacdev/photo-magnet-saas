"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import {
  FulfillmentClarityRow,
  PaymentClarityRow,
} from "@/lib/orderDetailClarity";
import {
  normalizeLegacyShippingType,
  shippingTypeLabel,
  type StorefrontShippingType,
} from "@/lib/shippingTypes";
import type { OrderDisplayStatus } from "@/lib/orderDisplayStatus";
import { isReadyToPrint } from "@/lib/sellerOrderPrintStatus";

type SellerOrderDetail = {
  orderId: string;
  status: string;
  displayStatus: OrderDisplayStatus;
  contextType: "EVENT" | "STOREFRONT";
  contextId: string;
  totalPrice: string;
  currency: string;
  createdAt: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingType: string | null;
  shippingAddress: unknown | null;
  printedAt: string | null;
  shippedAt: string | null;
  images: {
    id: string;
    renderedUrl: string | null;
    position: number;
    shapeId: string;
    printed: boolean;
    printedAt: string | null;
  }[];
  printSheets: { url: string; widthMm: number; heightMm: number }[];
};

export default function OrderDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [order, setOrder] = useState<SellerOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<
    "printPreview" | "printSelected" | "markPrinted" | "ship" | null
  >(null);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  /** Stays true until staggered PDF opens finish — avoids double POST / duplicate tabs. */
  const [isPrintingSelected, setIsPrintingSelected] = useState(false);
  const printSelectedLockRef = useRef(false);
  const [printFeedbackToast, setPrintFeedbackToast] = useState<string | null>(
    null,
  );
  const [customerEditOpen, setCustomerEditOpen] = useState(false);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editShippingType, setEditShippingType] =
    useState<StorefrontShippingType>("delivery");
  const [editFullAddress, setEditFullAddress] = useState("");
  const [editAddressNotes, setEditAddressNotes] = useState("");
  const [editLockerId, setEditLockerId] = useState("");
  /** After a successful "Print order", ask before marking — reinforces preview → confirm flow. */
  const [printOutcomePrompt, setPrintOutcomePrompt] = useState(false);

  function loadOrder() {
    if (!id) return;
    setLoading(true);
    setError(null);
    api<SellerOrderDetail>(`/api/orders/${encodeURIComponent(id)}`)
      .then(setOrder)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  /** Reconcile order after mutations (e.g. partial mark-printed) without full-page loading. */
  function refreshOrder() {
    if (!id) return;
    void api<SellerOrderDetail>(`/api/orders/${encodeURIComponent(id)}`)
      .then(setOrder)
      .catch((e: Error) => setError(e.message));
  }

  useEffect(() => {
    loadOrder();
    setPrintOutcomePrompt(false);
    setSelectedImageIds([]);
    setIsPrintingSelected(false);
    printSelectedLockRef.current = false;
    setPrintFeedbackToast(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when id changes
  }, [id]);

  const toggleImageSelected = useCallback((imageId: string) => {
    setSelectedImageIds((prev) =>
      prev.includes(imageId)
        ? prev.filter((i) => i !== imageId)
        : [...prev, imageId],
    );
  }, []);

  const unprintedImageIds = useMemo(
    () =>
      order?.images.filter((img) => !img.printed).map((img) => img.id) ?? [],
    [order?.images],
  );

  useEffect(() => {
    if (order?.printedAt) {
      setPrintOutcomePrompt(false);
    }
  }, [order?.printedAt]);

  useEffect(() => {
    if (!printFeedbackToast) return;
    const t = window.setTimeout(() => setPrintFeedbackToast(null), 4500);
    return () => clearTimeout(t);
  }, [printFeedbackToast]);

  function unlockPrintSelected() {
    printSelectedLockRef.current = false;
    setIsPrintingSelected(false);
    setActionBusy(null);
  }

  async function printSelectedImages() {
    if (!id || selectedImageIds.length === 0) return;
    if (printSelectedLockRef.current || isPrintingSelected) return;
    printSelectedLockRef.current = true;
    setIsPrintingSelected(true);
    setActionBusy("printSelected");
    setError(null);
    try {
      const data = await api<{ urls: string[] }>(
        `/api/orders/${encodeURIComponent(id)}/print-selected`,
        {
          method: "POST",
          body: { imageIds: selectedImageIds },
        },
      );
      const list = data.urls?.filter(Boolean) ?? [];
      const markedCount = selectedImageIds.length;
      for (let i = 0; i < list.length; i++) {
        const u = list[i];
        if (u) {
          window.setTimeout(() => {
            window.open(u, "_blank", "noopener,noreferrer");
          }, i * 250);
        }
      }
      setSelectedImageIds([]);
      setPrintFeedbackToast(
        markedCount === 1
          ? "1 image marked as printed"
          : `${markedCount} images marked as printed`,
      );
      refreshOrder();
      const staggerMs = list.length <= 1 ? 0 : (list.length - 1) * 250;
      window.setTimeout(unlockPrintSelected, staggerMs + 400);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not print selected images",
      );
      unlockPrintSelected();
    }
  }

  async function printOrderPreview() {
    if (!id) return;
    setActionBusy("printPreview");
    setError(null);
    try {
      const data = await api<{ url: string | null; urls: string[] }>(
        `/api/orders/${encodeURIComponent(id)}/print-preview`,
        { method: "POST" },
      );
      const list =
        data.urls?.length > 0
          ? data.urls
          : data.url
            ? [data.url]
            : [];
      for (let i = 0; i < list.length; i++) {
        const u = list[i];
        if (u) {
          window.setTimeout(() => {
            window.open(u, "_blank", "noopener,noreferrer");
          }, i * 250);
        }
      }
      setPrintOutcomePrompt(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate print preview");
    } finally {
      setActionBusy(null);
    }
  }

  async function markPrinted(body?: { imageIds?: string[] }) {
    if (!id) return;
    setActionBusy("markPrinted");
    setError(null);
    try {
      await api<{
        ok: boolean;
        printedAt: string | null;
        allImagesPrinted: boolean;
      }>(`/api/orders/${encodeURIComponent(id)}/mark-printed`, {
        method: "PATCH",
        body: body?.imageIds?.length ? { imageIds: body.imageIds } : undefined,
      });
      refreshOrder();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update");
    } finally {
      setActionBusy(null);
    }
  }

  function openCustomerEdit() {
    if (!order) return;
    setEditName(order.customerName ?? "");
    setEditPhone(order.customerPhone ?? "");
    setEditShippingType(normalizeLegacyShippingType(order.shippingType));
    const addr = order.shippingAddress;
    let fa = "";
    let notes = "";
    let lid = "";
    if (addr && typeof addr === "object" && !Array.isArray(addr)) {
      const full = (addr as { fullAddress?: unknown }).fullAddress;
      if (typeof full === "string") fa = full;
      const n = (addr as { notes?: unknown }).notes;
      if (typeof n === "string") notes = n;
      const locker = (addr as { lockerId?: unknown }).lockerId;
      if (typeof locker === "string") lid = locker;
    }
    setEditFullAddress(fa);
    setEditAddressNotes(notes);
    setEditLockerId(lid);
    setCustomerEditOpen(true);
  }

  async function saveCustomerEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !order) return;
    setCustomerSaving(true);
    setError(null);
    try {
      const body =
        order.contextType === "EVENT"
          ? {
              customerName: editName.trim(),
              ...(editPhone.trim() ? { customerPhone: editPhone.trim() } : {}),
            }
          : editShippingType === "pickup"
            ? {
                customerName: editName.trim(),
                customerPhone: editPhone.trim(),
                shippingType: "pickup",
                shippingAddress: null,
              }
            : editShippingType === "delivery"
              ? {
                  customerName: editName.trim(),
                  customerPhone: editPhone.trim(),
                  shippingType: "delivery",
                  shippingAddress: {
                    fullAddress: editFullAddress.trim(),
                    notes: editAddressNotes.trim(),
                  },
                }
              : {
                  customerName: editName.trim(),
                  customerPhone: editPhone.trim(),
                  shippingType: "boxnow",
                  shippingAddress: { lockerId: editLockerId.trim() },
                };
      await api<{ ok: boolean }>(
        `/api/orders/${encodeURIComponent(id)}/customer`,
        { method: "PATCH", body },
      );
      setCustomerEditOpen(false);
      loadOrder();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setCustomerSaving(false);
    }
  }

  async function markShipped() {
    if (!id) return;
    setActionBusy("ship");
    try {
      const data = await api<{ shippedAt: string }>(
        `/api/orders/${encodeURIComponent(id)}/ship`,
        { method: "PATCH" },
      );
      setOrder((o) =>
        o ? { ...o, shippedAt: data.shippedAt } : null,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update");
    } finally {
      setActionBusy(null);
    }
  }

  function formatMoney(amount: string, currency: string) {
    const n = Number(amount);
    if (Number.isNaN(n)) return amount;
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "EUR",
    }).format(n);
  }

  const canUsePrintFlow = Boolean(
    order && isReadyToPrint(order.status) && order.images.length > 0,
  );
  const hasOrderPrinted = Boolean(order?.printedAt);
  const showPrintOrder = canUsePrintFlow;
  const showMarkPrinted = Boolean(canUsePrintFlow && !hasOrderPrinted);
  const showMarkShipped = Boolean(
    order && order.printedAt && !order.shippedAt,
  );
  const hasCustomerInfo = Boolean(
    order &&
      (order.customerName ||
        order.customerEmail ||
        order.customerPhone ||
        order.shippingType ||
        order.shippingAddress),
  );

  return (
    <div className="relative flex flex-col gap-8 pb-8">
      {printFeedbackToast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed left-1/2 top-[4.75rem] z-[100] max-w-[min(90vw,20rem)] -translate-x-1/2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-center text-sm font-medium text-green-900 shadow-lg"
        >
          {printFeedbackToast}
        </div>
      )}
      <div>
        <Link
          href="/dashboard/orders"
          className="text-sm font-medium text-[#2563EB] hover:underline"
        >
          ← Orders
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-[#6B7280]">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !order ? (
        <p className="text-sm text-[#6B7280]">Order not found.</p>
      ) : (
        <>
          <div
            className={`flex flex-col gap-8 pb-8 ${
              selectedImageIds.length > 0 ? "pb-28 sm:pb-24" : ""
            }`}
          >
          <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
            <h1 className="text-lg font-semibold text-[#111111] sm:text-xl">
              Order
            </h1>
            <p className="mt-1 break-all font-mono text-xs text-[#6B7280]">
              {order.orderId}
            </p>
            <div className="mt-6 rounded-lg border border-gray-200 bg-[#FAFAFA] p-4 sm:p-5">
              <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                    Payment
                  </p>
                  <div className="mt-3">
                    <PaymentClarityRow status={order.status} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                    Fulfillment
                  </p>
                  <div className="mt-3">
                    <FulfillmentClarityRow
                      shippedAt={order.shippedAt}
                      printedAt={order.printedAt}
                      status={order.status}
                    />
                  </div>
                </div>
              </div>
            </div>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                  Type
                </dt>
                <dd className="mt-1 text-[#111111]">{order.contextType}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                  Total
                </dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-[#111111]">
                  {formatMoney(order.totalPrice, order.currency)}
                </dd>
              </div>
            </dl>

            {(showPrintOrder ||
              showMarkPrinted ||
              hasOrderPrinted ||
              showMarkShipped) && (
              <div className="mt-6 flex flex-col gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {showPrintOrder && (
                    <button
                      type="button"
                      disabled={actionBusy !== null}
                      onClick={() => void printOrderPreview()}
                      className="min-h-[48px] rounded-lg bg-[#2563EB] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-50 sm:min-w-[180px]"
                    >
                      {actionBusy === "printPreview"
                        ? "Preparing…"
                        : "Print order"}
                    </button>
                  )}
                  {showMarkPrinted && !printOutcomePrompt && (
                    <button
                      type="button"
                      disabled={actionBusy !== null}
                      onClick={() => void markPrinted()}
                      className="min-h-[48px] rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F9FAFB] disabled:opacity-50 sm:min-w-[180px]"
                    >
                      {actionBusy === "markPrinted"
                        ? "Updating…"
                        : "Mark as printed"}
                    </button>
                  )}
                  {hasOrderPrinted && (
                    <p className="flex min-h-[48px] items-center text-sm font-medium text-[#16A34A] sm:px-1">
                      Printed ✓
                    </p>
                  )}
                  {showMarkShipped && (
                    <button
                      type="button"
                      disabled={actionBusy !== null}
                      onClick={() => void markShipped()}
                      className="min-h-[48px] rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F9FAFB] disabled:opacity-50 sm:min-w-[180px]"
                    >
                      {actionBusy === "ship" ? "Updating…" : "Mark as shipped"}
                    </button>
                  )}
                </div>
                {showPrintOrder && !hasOrderPrinted && !printOutcomePrompt && (
                  <p className="text-xs text-[#6B7280]">
                    Open the PDF preview, then confirm when production printing is
                    done.
                  </p>
                )}
                {showMarkPrinted && printOutcomePrompt && (
                  <div className="rounded-lg border border-gray-200 bg-[#FAFAFA] p-4 sm:p-5">
                    <p className="text-sm font-medium text-[#111111]">
                      Did everything print correctly?
                    </p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        disabled={actionBusy !== null}
                        onClick={() => void markPrinted()}
                        className="min-h-[48px] rounded-lg bg-[#2563EB] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-50 sm:min-w-[200px]"
                      >
                        {actionBusy === "markPrinted"
                          ? "Updating…"
                          : "Yes → Mark all as printed"}
                      </button>
                      <button
                        type="button"
                        disabled={actionBusy !== null}
                        onClick={() => setPrintOutcomePrompt(false)}
                        className="min-h-[48px] rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F9FAFB] disabled:opacity-50 sm:min-w-[220px]"
                      >
                        No → I&apos;ll reprint some later
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 border-t border-gray-100 pt-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-sm font-semibold text-[#111111]">
                  Customer & shipping
                </h2>
                {!customerEditOpen && (
                  <button
                    type="button"
                    onClick={() => openCustomerEdit()}
                    className="min-h-[44px] text-left text-sm font-medium text-[#2563EB] hover:underline sm:text-right"
                  >
                    Edit customer info
                  </button>
                )}
              </div>
              {customerEditOpen && order ? (
                <form
                  onSubmit={(e) => void saveCustomerEdit(e)}
                  className="mt-4 flex flex-col gap-4"
                >
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-[#111111]">
                      Full name <span className="text-red-600">*</span>
                    </span>
                    <input
                      type="text"
                      name="name"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#111111] outline-none ring-[#2563EB] focus:ring-2"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-[#111111]">
                      Phone
                      {order.contextType === "STOREFRONT" && (
                        <span className="text-red-600"> *</span>
                      )}
                    </span>
                    <input
                      type="tel"
                      name="phone"
                      required={order.contextType === "STOREFRONT"}
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#111111] outline-none ring-[#2563EB] focus:ring-2"
                    />
                  </label>
                  {order.contextType === "STOREFRONT" && (
                    <>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium text-[#111111]">
                          Shipping method <span className="text-red-600">*</span>
                        </span>
                        <select
                          name="shippingType"
                          required
                          value={editShippingType}
                          onChange={(e) =>
                            setEditShippingType(
                              e.target.value as StorefrontShippingType,
                            )
                          }
                          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#111111] outline-none ring-[#2563EB] focus:ring-2"
                        >
                          <option value="pickup">Pickup</option>
                          <option value="delivery">Delivery</option>
                          <option value="boxnow">BoxNow</option>
                        </select>
                      </label>
                      {editShippingType === "delivery" && (
                        <>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium text-[#111111]">
                              Delivery address{" "}
                              <span className="text-red-600">*</span>
                            </span>
                            <textarea
                              name="fullAddress"
                              required
                              rows={4}
                              value={editFullAddress}
                              onChange={(e) =>
                                setEditFullAddress(e.target.value)
                              }
                              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#111111] outline-none ring-[#2563EB] focus:ring-2"
                            />
                          </label>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium text-[#111111]">
                              Delivery notes
                            </span>
                            <textarea
                              name="addressNotes"
                              rows={2}
                              value={editAddressNotes}
                              onChange={(e) =>
                                setEditAddressNotes(e.target.value)
                              }
                              placeholder="Apartment, gate code, instructions (optional)"
                              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#111111] outline-none ring-[#2563EB] focus:ring-2"
                            />
                          </label>
                        </>
                      )}
                      {editShippingType === "boxnow" && (
                        <label className="flex flex-col gap-1.5">
                          <span className="text-sm font-medium text-[#111111]">
                            BoxNow locker id{" "}
                            <span className="text-red-600">*</span>
                          </span>
                          <input
                            type="text"
                            name="lockerId"
                            required
                            value={editLockerId}
                            onChange={(e) => setEditLockerId(e.target.value)}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#111111] outline-none ring-[#2563EB] focus:ring-2"
                          />
                        </label>
                      )}
                    </>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="submit"
                      disabled={customerSaving}
                      className="min-h-[44px] rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-50"
                    >
                      {customerSaving ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      disabled={customerSaving}
                      onClick={() => setCustomerEditOpen(false)}
                      className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-[#111111] hover:bg-[#F9FAFB] disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : hasCustomerInfo ? (
                <dl className="mt-3 space-y-2 text-sm">
                  {order.customerName && (
                    <div>
                      <dt className="text-xs text-[#6B7280]">Name</dt>
                      <dd className="text-[#111111]">{order.customerName}</dd>
                    </div>
                  )}
                  {order.customerEmail && (
                    <div>
                      <dt className="text-xs text-[#6B7280]">Email</dt>
                      <dd className="text-[#111111]">{order.customerEmail}</dd>
                    </div>
                  )}
                  {order.customerPhone && (
                    <div>
                      <dt className="text-xs text-[#6B7280]">Phone</dt>
                      <dd className="text-[#111111]">{order.customerPhone}</dd>
                    </div>
                  )}
                  {order.shippingType && order.contextType === "STOREFRONT" && (
                    <div>
                      <dt className="text-xs text-[#6B7280]">
                        Shipping method
                      </dt>
                      <dd className="text-[#111111]">
                        {shippingTypeLabel(order.shippingType)}
                      </dd>
                    </div>
                  )}
                  {order.contextType === "STOREFRONT" &&
                    normalizeLegacyShippingType(order.shippingType) ===
                      "pickup" && (
                      <div>
                        <dt className="text-xs text-[#6B7280]">Address</dt>
                        <dd className="text-sm text-[#6B7280]">
                          No delivery address (pickup).
                        </dd>
                      </div>
                    )}
                  {order.contextType === "STOREFRONT" &&
                    normalizeLegacyShippingType(order.shippingType) ===
                      "delivery" &&
                    order.shippingAddress != null &&
                    typeof order.shippingAddress === "object" &&
                    !Array.isArray(order.shippingAddress) &&
                    typeof (order.shippingAddress as { fullAddress?: unknown })
                      .fullAddress === "string" && (
                      <div>
                        <dt className="text-xs text-[#6B7280]">
                          Delivery address
                        </dt>
                        <dd className="mt-1 whitespace-pre-wrap rounded-md bg-[#F9FAFB] p-2 text-sm text-[#111111]">
                          {
                            (order.shippingAddress as { fullAddress: string })
                              .fullAddress
                          }
                        </dd>
                      </div>
                    )}
                  {order.contextType === "STOREFRONT" &&
                    normalizeLegacyShippingType(order.shippingType) ===
                      "delivery" &&
                    order.shippingAddress != null &&
                    typeof order.shippingAddress === "object" &&
                    !Array.isArray(order.shippingAddress) &&
                    typeof (order.shippingAddress as { fullAddress?: unknown })
                      .fullAddress === "string" &&
                    typeof (order.shippingAddress as { notes?: unknown })
                      .notes === "string" &&
                    (order.shippingAddress as { notes: string }).notes
                      .trim().length > 0 && (
                      <div>
                        <dt className="text-xs text-[#6B7280]">
                          Delivery notes
                        </dt>
                        <dd className="mt-1 whitespace-pre-wrap rounded-md bg-[#F9FAFB] p-2 text-sm text-[#111111]">
                          {(order.shippingAddress as { notes: string }).notes}
                        </dd>
                      </div>
                    )}
                  {order.contextType === "STOREFRONT" &&
                    normalizeLegacyShippingType(order.shippingType) ===
                      "boxnow" &&
                    order.shippingAddress != null &&
                    typeof order.shippingAddress === "object" &&
                    !Array.isArray(order.shippingAddress) &&
                    typeof (order.shippingAddress as { lockerId?: unknown })
                      .lockerId === "string" && (
                      <div>
                        <dt className="text-xs text-[#6B7280]">
                          BoxNow locker id
                        </dt>
                        <dd className="mt-1 rounded-md bg-[#F9FAFB] p-2 font-mono text-sm text-[#111111]">
                          {
                            (order.shippingAddress as { lockerId: string })
                              .lockerId
                          }
                        </dd>
                      </div>
                    )}
                </dl>
              ) : (
                <p className="mt-3 text-sm text-[#6B7280]">
                  No customer details yet.
                </p>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-base font-semibold text-[#111111]">Images</h2>
            <p className="mt-1 text-xs text-[#6B7280]">
              Use <span className="font-medium text-[#111111]">Select unprinted</span>{" "}
              for the usual run, then print only those sheets. Tap cards to adjust.
              Printed items are dimmed but can be included for reprint.
            </p>
            {order.images.length === 0 ? (
              <p className="mt-3 text-sm text-[#6B7280]">
                No images available.
              </p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={unprintedImageIds.length === 0}
                    onClick={() => setSelectedImageIds(unprintedImageIds)}
                    className="rounded-lg border border-[#2563EB] bg-[#EFF6FF] px-3 py-2 text-sm font-semibold text-[#1D4ED8] transition-colors hover:bg-[#DBEAFE] disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:font-medium disabled:text-[#9CA3AF]"
                  >
                    Select unprinted
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedImageIds(order.images.map((img) => img.id))
                    }
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F9FAFB]"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    disabled={selectedImageIds.length === 0}
                    onClick={() => setSelectedImageIds([])}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Clear selection
                  </button>
                </div>
              <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {order.images.map((img) => {
                  const isSelected = selectedImageIds.includes(img.id);
                  return (
                    <li key={img.id} className="relative">
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        aria-label={
                          isSelected ? "Deselect image" : "Select image"
                        }
                        onClick={() => toggleImageSelected(img.id)}
                        className={`group relative aspect-square w-full overflow-hidden rounded-lg border bg-[#F9FAFB] text-left transition-shadow ${
                          isSelected
                            ? "border-[#2563EB] ring-2 ring-[#2563EB]"
                            : "border-gray-200"
                        }`}
                      >
                        {img.renderedUrl ? (
                          <img
                            src={img.renderedUrl}
                            alt=""
                            className={`h-full w-full object-cover ${
                              img.printed ? "opacity-60" : ""
                            }`}
                          />
                        ) : (
                          <div
                            className={`flex h-full items-center justify-center p-2 text-center text-xs text-[#6B7280] ${
                              img.printed ? "opacity-60" : ""
                            }`}
                          >
                            Not rendered
                          </div>
                        )}
                        <span
                          className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md border text-sm font-semibold shadow-sm ${
                            isSelected
                              ? "border-[#2563EB] bg-[#2563EB] text-white"
                              : "border-gray-200 bg-white/95 text-[#6B7280]"
                          }`}
                          aria-hidden
                        >
                          {isSelected ? "✓" : ""}
                        </span>
                        <span
                          className={`pointer-events-none absolute bottom-2 left-2 max-w-[calc(100%-3rem)] truncate rounded-md border px-2 py-1 text-[10px] font-semibold leading-tight shadow-sm ${
                            img.printed
                              ? "border-green-200 bg-green-50/95 text-green-800"
                              : "border-gray-200 bg-white/95 text-[#6B7280]"
                          }`}
                        >
                          {img.printed ? "✅ Printed" : "⚪ Not printed"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              </>
            )}
          </div>
          </div>

          {selectedImageIds.length > 0 && (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur-sm sm:px-6">
              <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3">
                <p className="text-sm text-[#111111]">
                  {selectedImageIds.length} selected
                </p>
                <button
                  type="button"
                  disabled={isPrintingSelected || actionBusy !== null}
                  onClick={() => void printSelectedImages()}
                  className="min-h-[48px] rounded-lg bg-[#2563EB] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
                >
                  {isPrintingSelected || actionBusy === "printSelected"
                    ? "Preparing…"
                    : `Print selected (${selectedImageIds.length})`}
                </button>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}
