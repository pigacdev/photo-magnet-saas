"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { api } from "@/lib/api";
import { OrderShell } from "@/components/order/OrderShell";
import { OrderStepHeader } from "@/components/order/OrderStepHeader";
import {
  orderBtnPrimary,
  orderCard,
  orderLoadingScreen,
} from "@/components/order/orderUi";
import {
  CHECKOUT_IMAGE_COPIES_STORAGE_KEY,
  type CatalogShape,
  type GetSessionImagesResponse,
  type GetSessionResponse,
  type PostOrderFinalizeResponse,
} from "@/lib/orderSessionTypes";
import { orderProductLineLabel } from "@/lib/orderSelectionUi";
import { readCheckoutImageCopies } from "@/lib/checkoutImageCopiesStorage";
import { sortMagnetImagesByPosition } from "@/lib/magnetImageSort";
import {
  buildStructuredShippingAddress,
  joinCustomerName,
  parseShippingAddressFromJson,
  splitCustomerName,
} from "@/lib/shippingAddress";
import {
  normalizeLegacyShippingType,
  type StorefrontShippingType,
} from "@/lib/shippingTypes";

const orderInputClass =
  "rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#111111] outline-none ring-[#2563EB] focus:ring-2";

function formatOrderTotal(amount: string, currency: string): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return amount;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.trim() || "EUR",
  }).format(n);
}

function formatSessionTotal(amount: number | null, currency: string): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.trim() || "EUR",
  }).format(amount);
}

type OrderSummaryShape = {
  shapeType: string;
  widthMm: number;
  heightMm: number;
  quantity: number;
};

type OrderCustomerLoad = {
  orderId: string;
  status: string;
  contextType: "EVENT" | "STOREFRONT";
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingType: string | null;
  shippingAddress: unknown | null;
  totalPrice: string;
  currency: string;
  imageCount: number;
  orderSummary?: OrderSummaryShape | null;
};

type SessionCheckoutSummary = {
  contextType: "event" | "storefront";
  totalPrice: number | null;
  currency: string;
  imageCount: number;
  selectedShape: CatalogShape | null;
  perItemSummary: { totalMagnets: number; lineTotal: number } | null;
  bundleQuantity: number | null;
};

function CustomerPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId")?.trim() ?? "";
  const fromSuccess = searchParams.get("from") === "success";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [orderCtx, setOrderCtx] = useState<OrderCustomerLoad | null>(null);
  const [sessionCtx, setSessionCtx] = useState<SessionCheckoutSummary | null>(
    null,
  );

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [shippingType, setShippingType] =
    useState<StorefrontShippingType>("delivery");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [city, setCity] = useState("");
  const [postCode, setPostCode] = useState("");
  const [country, setCountry] = useState("");
  const [liveQueryForReviewBack, setLiveQueryForReviewBack] = useState("");

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search.replace(/^\?/, ""));
    p.delete("orderId");
    setLiveQueryForReviewBack(p.toString());
  }, [searchParams]);

  function prefillFromOrder(o: OrderCustomerLoad) {
    const { firstName: fn, lastName: ln } = splitCustomerName(
      o.customerName ?? "",
    );
    setFirstName(fn);
    setLastName(ln);
    if (o.customerEmail) setEmail(o.customerEmail);
    if (o.customerPhone) setPhone(o.customerPhone);
    if (o.shippingType) {
      const normalized = normalizeLegacyShippingType(o.shippingType);
      if (normalized === "pickup" || normalized === "delivery") {
        setShippingType(normalized);
      }
    }
    const parsed = parseShippingAddressFromJson(o.shippingAddress);
    if (parsed.kind === "structured") {
      setStreet(parsed.structured.street);
      setHouseNumber(parsed.structured.houseNumber);
      setCity(parsed.structured.city);
      setPostCode(parsed.structured.postCode);
      setCountry(parsed.structured.country);
    } else if (parsed.kind === "legacy_full") {
      setStreet(parsed.legacyFullAddress);
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (orderId) {
      void (async () => {
        try {
          const o = await api<OrderCustomerLoad>(
            `/api/orders/${encodeURIComponent(orderId)}`,
          );
          if (cancelled) return;
          setOrderCtx(o);
          setSessionCtx(null);
          prefillFromOrder(o);
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Could not load order");
            setOrderCtx(null);
            setSessionCtx(null);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const [sessionRes, imagesRes] = await Promise.all([
          api<GetSessionResponse>("/api/session"),
          api<GetSessionImagesResponse>("/api/session/images"),
        ]);
        if (cancelled) return;
        if (!sessionRes.session) {
          setError("Session expired. Return to your cart to continue.");
          setOrderCtx(null);
          setSessionCtx(null);
          return;
        }
        if (imagesRes.error === "SESSION_INVALID") {
          setError("Session expired. Return to your cart to continue.");
          setOrderCtx(null);
          setSessionCtx(null);
          return;
        }
        const sorted = sortMagnetImagesByPosition(imagesRes.images);
        const currency = sessionRes.pricing[0]?.currency ?? "EUR";
        const isPer = sessionRes.session.pricingType === "per_item";
        const perItemRow = sessionRes.pricing.find((p) => p.type === "per_item");
        const pricePer =
          perItemRow != null ? Number(perItemRow.price) : 0;
        const stored = readCheckoutImageCopies();
        const byId = new Map(stored.map((r) => [r.imageId, r.copies]));
        let totalMagnets = 0;
        for (const img of sorted) {
          const c = byId.get(img.id);
          totalMagnets += typeof c === "number" && c >= 1 ? c : 1;
        }
        const lineTotal =
          isPer && Number.isFinite(pricePer) && pricePer >= 0
            ? Math.round(totalMagnets * pricePer * 100) / 100
            : 0;
        const selectedShape =
          sessionRes.shapes.find(
            (s) => s.id === sessionRes.session!.selectedShapeId,
          ) ?? null;
        setOrderCtx(null);
        setSessionCtx({
          contextType: sessionRes.session.contextType,
          totalPrice: sessionRes.session.totalPrice,
          currency,
          imageCount: sorted.length,
          selectedShape,
          perItemSummary: isPer ? { totalMagnets, lineTotal } : null,
          bundleQuantity: isPer ? null : sessionRes.session.quantity,
        });
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Could not load your session",
          );
          setOrderCtx(null);
          setSessionCtx(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const isEvent = useMemo(
    () =>
      orderCtx
        ? orderCtx.contextType === "EVENT"
        : sessionCtx?.contextType === "event",
    [orderCtx, sessionCtx],
  );

  const isSubmittedOrderEdit = Boolean(orderId && orderCtx);
  const isShipping = !isEvent && shippingType === "delivery";
  const customerName = joinCustomerName(firstName, lastName);

  const buildStorefrontShippingPayload = useCallback(() => {
    if (shippingType === "pickup") {
      return { shippingType: "pickup" as const, shippingAddress: null };
    }
    return {
      shippingType: "delivery" as const,
      shippingAddress: buildStructuredShippingAddress({
        street,
        houseNumber,
        city,
        postCode,
        country,
      }),
    };
  }, [shippingType, street, houseNumber, city, postCode, country]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (saving) return;
      if (orderId && orderCtx) {
        setError("");
        setSaving(true);
        try {
          const body =
            orderCtx.contextType === "EVENT"
              ? {
                  customerName,
                  customerEmail: email.trim(),
                  customerPhone: phone.trim(),
                }
              : {
                  customerName,
                  customerEmail: email.trim(),
                  customerPhone: phone.trim(),
                  ...buildStorefrontShippingPayload(),
                };
          await api<{ ok: boolean }>(
            `/api/orders/${encodeURIComponent(orderId)}/customer`,
            { method: "PATCH", body },
          );
          if (orderCtx.status !== "CANCELLED") {
            router.push(
              `/order/success?orderId=${encodeURIComponent(orderId)}`,
            );
            return;
          }
          const q =
            typeof window !== "undefined" ? window.location.search : "";
          const p = new URLSearchParams(q.replace(/^\?/, ""));
          p.set("orderId", orderId);
          router.push(`/order/success?${p.toString()}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save");
        } finally {
          setSaving(false);
        }
        return;
      }

      if (!sessionCtx) return;
      setError("");
      setSaving(true);
      try {
        const customerOnly: Record<string, unknown> = {
          customerName,
          customerEmail: email.trim(),
          phone: phone.trim(),
        };
        if (!isEvent) {
          Object.assign(customerOnly, buildStorefrontShippingPayload());
        }

        const body: Record<string, unknown> = {
          ...customerOnly,
        };
        const copyRows = readCheckoutImageCopies();
        if (copyRows.length > 0) {
          body.imageCopies = copyRows;
        }
        const result = await api<PostOrderFinalizeResponse>("/api/orders/finalize", {
          method: "POST",
          body,
        });
        if (!result.orderId) {
          setError("Could not place order. Try again.");
          return;
        }
        try {
          sessionStorage.removeItem(CHECKOUT_IMAGE_COPIES_STORAGE_KEY);
        } catch {
          // ignore
        }
        const q = typeof window !== "undefined" ? window.location.search : "";
        const p = new URLSearchParams(q.replace(/^\?/, ""));
        p.set("orderId", result.orderId);
        router.push(`/order/success?${p.toString()}`);
      } catch (err) {
        const code =
          err && typeof err === "object" && "code" in err
            ? (err as { code?: string }).code
            : undefined;
        if (
          code === "ORDER_LIMIT_REACHED" ||
          (err instanceof Error && err.message.includes("ORDER_LIMIT_REACHED"))
        ) {
          const q = typeof window !== "undefined" ? window.location.search : "";
          router.push(`/order/unavailable${q}`);
          return;
        }
        setError(err instanceof Error ? err.message : "Could not place order");
      } finally {
        setSaving(false);
      }
    },
    [
      orderId,
      orderCtx,
      sessionCtx,
      isEvent,
      customerName,
      email,
      phone,
      buildStorefrontShippingPayload,
      router,
      saving,
    ],
  );

  const reviewBackHref = useMemo(() => {
    const p = new URLSearchParams(
      liveQueryForReviewBack || searchParams.toString(),
    );
    p.delete("orderId");
    const q = p.toString();
    return `/order/review${q ? `?${q}` : ""}`;
  }, [liveQueryForReviewBack, searchParams]);

  const summaryShape = useMemo((): OrderSummaryShape | null => {
    if (orderCtx?.orderSummary) return orderCtx.orderSummary;
    if (!sessionCtx?.selectedShape) return null;
    const quantity =
      sessionCtx.perItemSummary?.totalMagnets ??
      sessionCtx.bundleQuantity ??
      sessionCtx.imageCount;
    return {
      shapeType: sessionCtx.selectedShape.shapeType,
      widthMm: sessionCtx.selectedShape.widthMm,
      heightMm: sessionCtx.selectedShape.heightMm,
      quantity,
    };
  }, [orderCtx, sessionCtx]);

  const totalLabel = orderCtx
    ? formatOrderTotal(orderCtx.totalPrice, orderCtx.currency)
    : sessionCtx?.perItemSummary
      ? formatSessionTotal(
          sessionCtx.perItemSummary.lineTotal,
          sessionCtx.currency,
        )
      : formatSessionTotal(
          sessionCtx?.totalPrice ?? null,
          sessionCtx?.currency ?? "EUR",
        );

  if (loading) {
    return (
      <div className={orderLoadingScreen}>
        <p className="text-sm text-[#6B7280]">Loading…</p>
      </div>
    );
  }

  if (orderId && error && !orderCtx) {
    return (
      <OrderShell className="pb-10">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-red-700">{error}</p>
          <Link
            href={reviewBackHref}
            className="text-sm font-medium text-[#2563EB] underline"
          >
            Back to review
          </Link>
        </div>
      </OrderShell>
    );
  }

  if (!orderId && error && !sessionCtx) {
    return (
      <OrderShell className="pb-10">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-red-700">{error}</p>
          <Link
            href={reviewBackHref}
            className="text-sm font-medium text-[#2563EB] underline"
          >
            Back to review
          </Link>
        </div>
      </OrderShell>
    );
  }

  if (!orderCtx && !sessionCtx) return null;

  return (
    <OrderShell contentWidth="medium" className="pb-10">
      <div className="flex flex-col gap-6">
        <OrderStepHeader
          title={
            isSubmittedOrderEdit
              ? fromSuccess
                ? "Update your details"
                : "Your details"
              : "Your details"
          }
          subtitle={
            isSubmittedOrderEdit
              ? "Fix typos in your name, phone, or address."
              : isEvent
                ? "We use this for your order at the event."
                : "Choose how you receive your order and enter your shipping details."
          }
          step={{ current: 5, total: 5, label: "Details" }}
        />

        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-6">
          {!isEvent && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                Preferred delivery type
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {(
                  [
                    { value: "delivery" as const, label: "Shipping" },
                    { value: "pickup" as const, label: "Pickup" },
                  ] as const
                ).map(({ value, label }) => {
                  const selected = shippingType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setShippingType(value)}
                      className={`min-h-[56px] rounded-2xl border-2 px-4 py-3 text-left transition-colors ${
                        selected
                          ? "border-[#2563EB] bg-white shadow-sm"
                          : "border-gray-200 bg-white active:bg-[#F9FAFB]"
                      }`}
                    >
                      <span className="block text-sm font-medium text-[#111111]">
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section className={orderCard}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              {isEvent ? "Your details" : "Shipping details"}
            </h2>
            <div className="mt-4 flex flex-col gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-[#111111]">
                    First name <span className="text-red-600">*</span>
                  </span>
                  <input
                    type="text"
                    name="firstName"
                    autoComplete="given-name"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={orderInputClass}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-[#111111]">
                    Last name <span className="text-red-600">*</span>
                  </span>
                  <input
                    type="text"
                    name="lastName"
                    autoComplete="family-name"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={orderInputClass}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-[#111111]">
                  Email <span className="text-red-600">*</span>
                </span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={orderInputClass}
                />
                <span className="text-xs text-[#6B7280]">
                  We will send your order confirmation to this address.
                </span>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-[#111111]">
                  Phone <span className="text-red-600">*</span>
                </span>
                <input
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={orderInputClass}
                />
              </label>

              {isShipping && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-1.5 md:col-span-2">
                      <span className="text-sm font-medium text-[#111111]">
                        Street <span className="text-red-600">*</span>
                      </span>
                      <input
                        type="text"
                        name="street"
                        autoComplete="address-line1"
                        required
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        className={orderInputClass}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-[#111111]">
                        House number <span className="text-red-600">*</span>
                      </span>
                      <input
                        type="text"
                        name="houseNumber"
                        autoComplete="off"
                        required
                        value={houseNumber}
                        onChange={(e) => setHouseNumber(e.target.value)}
                        className={orderInputClass}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-[#111111]">
                        City <span className="text-red-600">*</span>
                      </span>
                      <input
                        type="text"
                        name="city"
                        autoComplete="address-level2"
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className={orderInputClass}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-[#111111]">
                        Post code <span className="text-red-600">*</span>
                      </span>
                      <input
                        type="text"
                        name="postCode"
                        autoComplete="postal-code"
                        required
                        value={postCode}
                        onChange={(e) => setPostCode(e.target.value)}
                        className={orderInputClass}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-[#111111]">
                        Country <span className="text-red-600">*</span>
                      </span>
                      <input
                        type="text"
                        name="country"
                        autoComplete="country-name"
                        required
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className={orderInputClass}
                      />
                    </label>
                  </div>
                </>
              )}

            </div>
          </section>

          <section className={orderCard}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              Order summary
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              {summaryShape && (
                <div className="flex justify-between gap-4">
                  <dt className="text-[#6B7280]">Product</dt>
                  <dd className="text-right font-medium text-[#111111]">
                    {orderProductLineLabel(summaryShape, summaryShape.quantity)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-t border-gray-100 pt-2">
                <dt className="text-[#6B7280]">Total</dt>
                <dd className="text-base font-semibold tabular-nums text-[#111111]">
                  {totalLabel}
                </dd>
              </div>
            </dl>
            {!isEvent && (
              <p className="mt-3 text-xs leading-relaxed text-[#6B7280]">
                Shipping cost and taxes will be calculated based on your details
                and sent to your email with the invoice.
              </p>
            )}
          </section>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className={orderBtnPrimary}
          >
            {saving
              ? "Saving…"
              : isSubmittedOrderEdit
                ? "Save changes"
                : "Submit order"}
          </button>
        </form>

        <Link
          href={reviewBackHref}
          className="text-sm font-medium text-[#2563EB] underline-offset-4 hover:underline"
        >
          Back to review
        </Link>
      </div>
    </OrderShell>
  );
}

export default function OrderCustomerPage() {
  return (
    <Suspense
      fallback={
        <div className={orderLoadingScreen}>
          <p className="text-sm text-[#6B7280]">Loading…</p>
        </div>
      }
    >
      <CustomerPageInner />
    </Suspense>
  );
}
