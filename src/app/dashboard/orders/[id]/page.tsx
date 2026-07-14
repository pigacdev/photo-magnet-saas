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
import { getDisplayPreferences } from "@/lib/auth";
import { formatDisplayDateTime } from "@/lib/dateFormat";
import { CustomerEditModal } from "@/components/dashboard/CustomerEditModal";
import { CancelOrderModal } from "@/components/dashboard/CancelOrderModal";
import { PrintOutcomeModal } from "@/components/dashboard/PrintOutcomeModal";
import { SendOrderEmailModal } from "@/components/dashboard/SendOrderEmailModal";
import { ManualSendEmailUpgradeModal } from "@/components/dashboard/ManualSendEmailUpgradeModal";
import { OrderStatusRow } from "@/lib/orderDetailClarity";
import {
  normalizeLegacyShippingType,
  shippingTypeLabel,
} from "@/lib/shippingTypes";
import {
  formatShippingAddressLines,
  parseShippingAddressFromJson,
} from "@/lib/shippingAddress";
import {
  nextStatusOptions,
  orderStatusLabel,
  type OrderWorkflowStatus,
} from "@/lib/orderDisplayStatus";
import { isReadyToPrint, isReadyToPrintPreview } from "@/lib/sellerOrderPrintStatus";
import {
  orderContextHref,
  orderContextKindLabel,
} from "@/lib/orderContextDisplay";
import { formatOrderReference } from "@/lib/orderReference";
import { OrderImageSelectCard } from "@/components/dashboard/OrderImageSelectCard";
import { OrderImageDeleteConfirmModal } from "@/components/dashboard/OrderImageDeleteConfirmModal";
import { invalidateNewOrdersCount } from "@/lib/newOrdersCount";
import { useOrganizationUsage } from "@/hooks/useOrganizationUsage";
import { usageHasFeature } from "@/lib/planFeatures";

type SellerOrderDetail = {
  orderId: string;
  shortCode: string | null;
  status: string;
  cancellationNote?: string | null;
  eventPaymentPreference?: string | null;
  contextType: "EVENT" | "STOREFRONT";
  contextId: string;
  contextName: string | null;
  totalPrice: string;
  currency: string;
  createdAt: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingType: string | null;
  shippingAddress: unknown | null;
  storefrontPickupAddress?: {
    street: string;
    houseNumber: string;
    city: string;
    postCode: string;
    country: string;
  } | null;
  printedAt: string | null;
  shippedAt: string | null;
  images: {
    id: string;
    renderedUrl: string | null;
    /** Present when retention cleanup removed blobs; UI may show placeholder instead of `<img>`. */
    mediaDeletedAt: string | null;
    deletedAt?: string | null;
    position: number;
    shapeId: string;
    shapeType: string;
    widthMm: number;
    heightMm: number;
    copies: number;
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
    | "printPreview"
    | "printSelected"
    | "markPrinted"
    | "status"
    | "deleteImages"
    | null
  >(null);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  /** Stays true until staggered PDF opens finish — avoids double POST / duplicate tabs. */
  const [isPrintingSelected, setIsPrintingSelected] = useState(false);
  const printSelectedLockRef = useRef(false);
  const [printFeedbackToast, setPrintFeedbackToast] = useState<string | null>(
    null,
  );
  const [customerEditOpen, setCustomerEditOpen] = useState(false);
  const [sendEmailOpen, setSendEmailOpen] = useState(false);
  const [sendEmailUpgradeOpen, setSendEmailUpgradeOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [deleteImagesConfirmOpen, setDeleteImagesConfirmOpen] = useState(false);
  /** After a successful "Print order", ask before marking — reinforces preview → confirm flow. */
  const [printOutcomePrompt, setPrintOutcomePrompt] = useState(false);
  const [referenceCopied, setReferenceCopied] = useState(false);

  const usage = useOrganizationUsage();
  const canManualSendEmail = usageHasFeature(usage, "manual_send_email");

  const orderReference = useMemo(
    () =>
      order
        ? formatOrderReference({ id: order.orderId, shortCode: order.shortCode })
        : "",
    [order],
  );

  const copyOrderReference = useCallback(async () => {
    if (!orderReference) return;
    try {
      await navigator.clipboard.writeText(orderReference);
      setReferenceCopied(true);
      window.setTimeout(() => setReferenceCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, [orderReference]);

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

  const toggleImageSelected = useCallback(
    (imageId: string) => {
      const img = order?.images.find((i) => i.id === imageId);
      if (img?.deletedAt || img?.mediaDeletedAt) return;
      setSelectedImageIds((prev) =>
        prev.includes(imageId)
          ? prev.filter((i) => i !== imageId)
          : [...prev, imageId],
      );
    },
    [order],
  );

  const printableImages = useMemo(
    () =>
      order?.images.filter(
        (img) => img.mediaDeletedAt == null && !img.deletedAt,
      ) ?? [],
    [order],
  );

  const allMediaRemoved = useMemo(
    () =>
      order !== null &&
      order.images.length > 0 &&
      order.images.every(
        (img) => img.mediaDeletedAt != null || img.deletedAt != null,
      ),
    [order],
  );

  const unprintedImageIds = useMemo(
    () => printableImages.filter((img) => !img.printed).map((img) => img.id),
    [printableImages],
  );

  const selectedImageCount = selectedImageIds.length;
  const selectedMagnetCount = useMemo(() => {
    if (!order?.images?.length || selectedImageIds.length === 0) return 0;
    const selected = new Set(selectedImageIds);
    let sum = 0;
    for (const img of order.images) {
      if (selected.has(img.id)) {
        sum += img.copies ?? 1;
      }
    }
    return sum;
  }, [order?.images, selectedImageIds]);

  const printSelectedLabel = useMemo(() => {
    const imgWord = selectedImageCount === 1 ? "image" : "images";
    const magWord = selectedMagnetCount === 1 ? "magnet" : "magnets";
    return `Print selected (${selectedImageCount} ${imgWord} / ${selectedMagnetCount} ${magWord})`;
  }, [selectedImageCount, selectedMagnetCount]);

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

  useEffect(() => {
    if (order && allMediaRemoved) {
      setSelectedImageIds([]);
      setPrintOutcomePrompt(false);
    }
  }, [order, allMediaRemoved]);

  function unlockPrintSelected() {
    printSelectedLockRef.current = false;
    setIsPrintingSelected(false);
    setActionBusy(null);
  }

  async function advanceOrderStatus(
    nextStatus: OrderWorkflowStatus,
    cancellationNote?: string | null,
  ) {
    if (!id) return;
    const wasNew = order?.status === "NEW";
    setActionBusy("status");
    setError(null);
    try {
      await api<{
        ok: boolean;
        status: string;
        cancellationNote?: string | null;
      }>(`/api/orders/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: {
          status: nextStatus,
          ...(nextStatus === "CANCELLED" ? { cancellationNote } : {}),
        },
      });
      setCancelModalOpen(false);
      refreshOrder();
      if (wasNew) invalidateNewOrdersCount();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update status");
    } finally {
      setActionBusy(null);
    }
  }

  function handleStatusAction(next: OrderWorkflowStatus) {
    if (next === "CANCELLED") {
      setCancelModalOpen(true);
      return;
    }
    void advanceOrderStatus(next);
  }

  function handleConfirmCancel(note: string | null) {
    void advanceOrderStatus("CANCELLED", note);
  }

  async function printSelectedImages() {
    if (!id || selectedImageIds.length === 0 || allMediaRemoved) return;
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
    if (!id || allMediaRemoved) return;
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
      if (order && isReadyToPrint(order)) {
        setPrintOutcomePrompt(true);
      }
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
      setPrintOutcomePrompt(false);
      refreshOrder();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleMarkSelectedPrinted() {
    if (!id || selectedImageIds.length === 0 || allMediaRemoved) return;
    setActionBusy("markPrinted");
    setError(null);
    try {
      await api<{
        ok: boolean;
        printedAt: string | null;
        allImagesPrinted: boolean;
      }>(`/api/orders/${encodeURIComponent(id)}/mark-printed`, {
        method: "PATCH",
        body: { imageIds: selectedImageIds },
      });
      setSelectedImageIds([]);
      refreshOrder();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update");
    } finally {
      setActionBusy(null);
    }
  }

  async function deleteSelectedImages() {
    if (!id || selectedImageIds.length === 0) return;
    setActionBusy("deleteImages");
    setError(null);
    try {
      for (const imageId of selectedImageIds) {
        await api(
          `/api/orders/${encodeURIComponent(id)}/images/${encodeURIComponent(imageId)}`,
          { method: "DELETE" },
        );
      }
      setSelectedImageIds([]);
      setDeleteImagesConfirmOpen(false);
      refreshOrder();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete images");
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

  /** Same pattern as Orders list “Created” column. */
  function formatDate(iso: string) {
    return formatDisplayDateTime(iso, getDisplayPreferences().dateFormat);
  }

  const canPrintNow = Boolean(
    order &&
      isReadyToPrint(order) &&
      printableImages.length > 0 &&
      !allMediaRemoved,
  );
  const canPreviewPrint = Boolean(
    order &&
      isReadyToPrintPreview(order) &&
      printableImages.length > 0 &&
      !allMediaRemoved,
  );
  const awaitingPayment = Boolean(
    order &&
      canPreviewPrint &&
      !canPrintNow,
  );

  const statusActions = order
    ? nextStatusOptions(order.status).filter(
        (next) => next !== "SHIPPED" || Boolean(order.printedAt),
      )
    : [];

  const hasOrderPrinted = Boolean(order?.printedAt);
  const showPrintOrder = canPreviewPrint;
  const showMarkPrinted = Boolean(canPrintNow && !hasOrderPrinted);
  const orderStatusActionButtonClass =
    "min-h-[44px] rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface disabled:opacity-50 sm:min-w-[160px]";
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
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Orders
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !order ? (
        <p className="text-sm text-muted-foreground">Order not found.</p>
      ) : (
        <>
          <div
            className={`flex flex-col gap-8 pb-8 ${
              selectedImageIds.length > 0 ? "pb-28 sm:pb-24" : ""
            }`}
          >
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-lg font-semibold text-foreground sm:text-xl">
                Order ({orderReference})
              </h1>
              <button
                type="button"
                onClick={() => void copyOrderReference()}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-background/80"
              >
                {referenceCopied ? "Copied!" : "Copy reference"}
              </button>
            </div>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              <p>Created: {formatDate(order.createdAt)}</p>
              {allMediaRemoved ? (
                <p>
                  Media removed after retention period — printing is not
                  available.
                </p>
              ) : null}
            </div>
            <div className="mt-6 rounded-lg border border-border bg-surface p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Order status
              </p>
              <div className="mt-3">
                <OrderStatusRow
                  status={order.status}
                  cancellationNote={order.cancellationNote}
                />
              </div>
              {statusActions.length > 0 && (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {statusActions.map((next) => (
                    <button
                      key={next}
                      type="button"
                      disabled={actionBusy !== null}
                      onClick={() => handleStatusAction(next)}
                      className={orderStatusActionButtonClass}
                    >
                      {actionBusy === "status"
                        ? "Updating…"
                        : `Mark as ${orderStatusLabel(next)}`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {orderContextKindLabel(order.contextType)}
                </dt>
                <dd className="mt-1 text-foreground">
                  {order.contextName ? (
                    <Link
                      href={orderContextHref(order.contextType, order.contextId)}
                      className="font-medium text-primary hover:underline"
                    >
                      {order.contextName}
                    </Link>
                  ) : (
                    orderContextKindLabel(order.contextType)
                  )}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total
                </dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                  {formatMoney(order.totalPrice, order.currency)}
                </dd>
              </div>
            </dl>

            {(showPrintOrder || showMarkPrinted || hasOrderPrinted) && (
              <div className="mt-6 flex flex-col gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
                  {showPrintOrder && (
                    <div className="flex flex-col items-start gap-1.5">
                      <button
                        type="button"
                        disabled={actionBusy !== null || !canPreviewPrint}
                        onClick={() => void printOrderPreview()}
                        className="min-h-[48px] rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-50 sm:min-w-[180px]"
                      >
                        {actionBusy === "printPreview"
                          ? "Preparing…"
                          : canPrintNow
                            ? "Print order"
                            : "Preview PDF"}
                      </button>
                      {!allMediaRemoved && (
                        <p className="text-sm text-muted-foreground">
                          {printableImages.filter((img) => img.printed).length} /{" "}
                          {printableImages.length} images printed
                        </p>
                      )}
                    </div>
                  )}
                  {showMarkPrinted && !printOutcomePrompt && (
                    <button
                      type="button"
                      disabled={actionBusy !== null}
                      onClick={() => void markPrinted()}
                      className={orderStatusActionButtonClass}
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
                </div>
                {awaitingPayment && (
                  <p className="text-xs text-muted-foreground">
                    Preview the PDF anytime. Mark as Paid before confirming
                    production print.
                  </p>
                )}
                {showPrintOrder &&
                  !hasOrderPrinted &&
                  !printOutcomePrompt &&
                  canPrintNow && (
                  <p className="text-xs text-muted-foreground">
                    Open the PDF preview, then confirm when production printing is
                    done.
                  </p>
                )}
              </div>
            )}

          </div>

          <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-foreground sm:text-xl">
                  Customer & shipping
                </h2>
                <button
                  type="button"
                  onClick={() => setCustomerEditOpen(true)}
                  className="min-h-[44px] text-left text-sm font-medium text-primary hover:underline sm:text-right"
                >
                  Edit customer info
                </button>
              </div>
              {hasCustomerInfo ? (
                <dl className="mt-3 space-y-2 text-sm">
                  {order.customerName && (
                    <div>
                      <dt className="text-xs text-muted-foreground">Name</dt>
                      <dd className="text-foreground">{order.customerName}</dd>
                    </div>
                  )}
                  {order.customerEmail && (
                    <div>
                      <dt className="text-xs text-muted-foreground">Email</dt>
                      <dd className="text-foreground">{order.customerEmail}</dd>
                    </div>
                  )}
                  {order.customerPhone && (
                    <div>
                      <dt className="text-xs text-muted-foreground">Phone</dt>
                      <dd className="text-foreground">{order.customerPhone}</dd>
                    </div>
                  )}
                  {order.shippingType && order.contextType === "STOREFRONT" && (
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Shipping method
                      </dt>
                      <dd className="text-foreground">
                        {shippingTypeLabel(order.shippingType)}
                      </dd>
                    </div>
                  )}
                  {order.contextType === "STOREFRONT" &&
                    normalizeLegacyShippingType(order.shippingType) ===
                      "pickup" && (
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          Pickup location
                        </dt>
                        {order.storefrontPickupAddress != null &&
                        formatShippingAddressLines(order.storefrontPickupAddress)
                          .length > 0 ? (
                          <dd className="mt-1 whitespace-pre-wrap rounded-md bg-surface p-2 text-sm text-foreground">
                            {formatShippingAddressLines(
                              order.storefrontPickupAddress,
                            ).join("\n")}
                          </dd>
                        ) : (
                          <dd className="text-sm text-muted-foreground">
                            No pickup address configured.
                          </dd>
                        )}
                      </div>
                    )}
                  {order.contextType === "STOREFRONT" &&
                    normalizeLegacyShippingType(order.shippingType) ===
                      "delivery" &&
                    order.shippingAddress != null &&
                    (() => {
                      const parsed = parseShippingAddressFromJson(
                        order.shippingAddress,
                      );
                      const lines =
                        parsed.kind === "legacy_full"
                          ? [
                              parsed.legacyFullAddress,
                              ...(parsed.legacyNotes
                                ? [parsed.legacyNotes]
                                : []),
                            ]
                          : formatShippingAddressLines(order.shippingAddress);
                      if (lines.length === 0) return null;
                      return (
                        <div>
                          <dt className="text-xs text-muted-foreground">
                            Delivery address
                          </dt>
                          <dd className="mt-1 whitespace-pre-wrap rounded-md bg-surface p-2 text-sm text-foreground">
                            {lines.join("\n")}
                          </dd>
                        </div>
                      );
                    })()}
                  {order.contextType === "STOREFRONT" &&
                    normalizeLegacyShippingType(order.shippingType) ===
                      "boxnow" &&
                    order.shippingAddress != null &&
                    typeof order.shippingAddress === "object" &&
                    !Array.isArray(order.shippingAddress) &&
                    typeof (order.shippingAddress as { lockerId?: unknown })
                      .lockerId === "string" && (
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          BoxNow locker id
                        </dt>
                        <dd className="mt-1 rounded-md bg-surface p-2 font-mono text-sm text-foreground">
                          {
                            (order.shippingAddress as { lockerId: string })
                              .lockerId
                          }
                        </dd>
                      </div>
                    )}
                </dl>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  No customer details yet.
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!canManualSendEmail) {
                    setSendEmailUpgradeOpen(true);
                    return;
                  }
                  setSendEmailOpen(true);
                }}
                className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#16A34A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#15803D] sm:w-auto"
              >
                Send email
              </button>
          </div>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">Images</h2>
            {!allMediaRemoved && printableImages.length > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Use{" "}
                <span className="font-medium text-foreground">Select unprinted</span>{" "}
                for the usual run, then print only those sheets. Tap cards to adjust.
                Printed items are dimmed but can be included for reprint.
              </p>
            ) : null}
            {order.images.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No images available.
              </p>
            ) : allMediaRemoved ? (
              <p className="mt-3 rounded-lg border border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
                Media removed after retention period.
              </p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={unprintedImageIds.length === 0}
                    onClick={() => setSelectedImageIds(unprintedImageIds)}
                    className="rounded-lg border border-primary bg-blue-50 dark:bg-blue-950/40 px-3 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300 transition-colors hover:bg-blue-100 dark:hover:bg-blue-950/60 disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:font-medium disabled:text-muted-foreground"
                  >
                    Select unprinted
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedImageIds(printableImages.map((img) => img.id))
                    }
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    disabled={selectedImageIds.length === 0}
                    onClick={() => setSelectedImageIds([])}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Clear selection
                  </button>
                </div>
                <ul className="mt-4 flex flex-wrap gap-3">
                  {order.images.map((img) => (
                    <li key={img.id}>
                      <OrderImageSelectCard
                        renderedUrl={img.renderedUrl}
                        shape={{
                          shapeType: img.shapeType,
                          widthMm: img.widthMm,
                          heightMm: img.heightMm,
                        }}
                        copies={img.copies ?? 1}
                        printed={img.printed}
                        removed={
                          img.mediaDeletedAt != null || img.deletedAt != null
                        }
                        selected={selectedImageIds.includes(img.id)}
                        onToggle={() => toggleImageSelected(img.id)}
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          </div>

          {selectedImageIds.length > 0 && !allMediaRemoved && (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur-sm sm:px-6">
              <div className="flex w-full flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-foreground">
                  {selectedImageIds.length} selected
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={actionBusy !== null}
                    onClick={() => setDeleteImagesConfirmOpen(true)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    {actionBusy === "deleteImages" ? "Deleting…" : "Delete selected"}
                  </button>
                  <button
                    type="button"
                    disabled={
                      !canPrintNow ||
                      isPrintingSelected ||
                      actionBusy !== null
                    }
                    onClick={() => void handleMarkSelectedPrinted()}
                    className="rounded border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface disabled:opacity-50"
                  >
                    {actionBusy === "markPrinted"
                      ? "Updating…"
                      : `Mark selected as printed (${selectedImageIds.length})`}
                  </button>
                  <button
                    type="button"
                    disabled={
                      !canPrintNow ||
                      isPrintingSelected ||
                      actionBusy !== null
                    }
                    onClick={() => void printSelectedImages()}
                    className="min-h-[48px] rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
                  >
                    {isPrintingSelected || actionBusy === "printSelected"
                      ? "Preparing…"
                      : printSelectedLabel}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {customerEditOpen && order && (
        <CustomerEditModal
          open={customerEditOpen}
          order={order}
          onClose={() => setCustomerEditOpen(false)}
          onSaved={refreshOrder}
        />
      )}

      {sendEmailOpen && order && canManualSendEmail && (
        <SendOrderEmailModal
          open={sendEmailOpen}
          orderId={order.orderId}
          orderReference={orderReference}
          customerEmail={order.customerEmail}
          onClose={() => setSendEmailOpen(false)}
          onSent={() => setPrintFeedbackToast("Email sent")}
        />
      )}

      <ManualSendEmailUpgradeModal
        open={sendEmailUpgradeOpen}
        onClose={() => setSendEmailUpgradeOpen(false)}
      />

      <CancelOrderModal
        open={cancelModalOpen}
        saving={actionBusy === "status"}
        onClose={() => {
          if (actionBusy !== "status") setCancelModalOpen(false);
        }}
        onConfirm={handleConfirmCancel}
      />

      <PrintOutcomeModal
        open={printOutcomePrompt}
        saving={actionBusy === "markPrinted"}
        onClose={() => {
          if (actionBusy !== "markPrinted") setPrintOutcomePrompt(false);
        }}
        onConfirm={() => void markPrinted()}
      />

      <OrderImageDeleteConfirmModal
        open={deleteImagesConfirmOpen}
        imageCount={selectedImageIds.length}
        saving={actionBusy === "deleteImages"}
        onClose={() => {
          if (actionBusy !== "deleteImages") setDeleteImagesConfirmOpen(false);
        }}
        onConfirm={() => void deleteSelectedImages()}
      />

    </div>
  );
}
