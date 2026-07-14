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
  orderAlertWarning,
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
import { DEFAULT_SIZE_UNIT, type SizeUnit } from "@/lib/magnetSize";
import { readCheckoutImageCopies } from "@/lib/checkoutImageCopiesStorage";
import { sortMagnetImagesByPosition } from "@/lib/magnetImageSort";
import {
  buildStructuredShippingAddress,
  formatShippingAddressLines,
  joinCustomerName,
  parseShippingAddressFromJson,
  splitCustomerName,
  type StructuredShippingAddress,
} from "@/lib/shippingAddress";
import {
  normalizeLegacyShippingType,
  type StorefrontShippingType,
} from "@/lib/shippingTypes";
import { LEGAL_LINKS, LEGAL_RETENTION_DEFAULTS } from "@/lib/legalConstants";

const orderInputClass =
  "rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none ring-primary focus:ring-2";

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
  storefrontPickupAddress?: StructuredShippingAddress | null;
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
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>(DEFAULT_SIZE_UNIT);

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
  const [storefrontPickupAddress, setStorefrontPickupAddress] =
    useState<StructuredShippingAddress | null>(null);
  const [liveQueryForReviewBack, setLiveQueryForReviewBack] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);

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
          setStorefrontPickupAddress(o.storefrontPickupAddress ?? null);
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
          bundleQuantity: isPer ? null : totalMagnets,
        });
        if (sessionRes.displayPreferences?.sizeUnit) {
          setSizeUnit(sessionRes.displayPreferences.sizeUnit);
        }
        setStorefrontPickupAddress(
          sessionRes.storefront?.pickupAddress ?? null,
        );
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
  const pickupAvailable = storefrontPickupAddress != null;
  const isShipping = !isEvent && shippingType === "delivery";
  const isPickup = !isEvent && shippingType === "pickup";
  const pickupLocationLines = useMemo(
    () => formatShippingAddressLines(storefrontPickupAddress),
    [storefrontPickupAddress],
  );

  useEffect(() => {
    if (isEvent || pickupAvailable) return;
    if (isSubmittedOrderEdit && shippingType === "pickup") return;
    if (shippingType !== "delivery") {
      setShippingType("delivery");
    }
  }, [isEvent, pickupAvailable, isSubmittedOrderEdit, shippingType]);
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
          consentAccepted: true,
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
        <p className="text-sm text-muted-foreground">Loading…</p>
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
            className="text-sm font-medium text-primary underline"
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
            className="text-sm font-medium text-primary underline"
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
                : pickupAvailable
                  ? "Choose how you receive your order and enter your shipping details."
                  : "Enter your shipping details."
          }
          step={{ current: 5, total: 5, label: "Details" }}
        />

        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-6">
          {!isEvent && pickupAvailable && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                          ? "border-primary bg-background shadow-sm"
                          : "border-border bg-background active:bg-surface"
                      }`}
                    >
                      <span className="block text-sm font-medium text-foreground">
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {!isEvent && isPickup && pickupAvailable && (
            <section className={orderCard}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pickup location
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                {pickupLocationLines.join("\n")}
              </p>
            </section>
          )}

          <section className={orderCard}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {isEvent || isPickup ? "Your details" : "Shipping details"}
            </h2>
            <div className="mt-4 flex flex-col gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">
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
                  <span className="text-sm font-medium text-foreground">
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
                <span className="text-sm font-medium text-foreground">
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
                <span className="text-xs text-muted-foreground">
                  We will send your order confirmation to this address.
                </span>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">
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
                      <span className="text-sm font-medium text-foreground">
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
                      <span className="text-sm font-medium text-foreground">
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
                      <span className="text-sm font-medium text-foreground">
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
                      <span className="text-sm font-medium text-foreground">
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
                      <span className="text-sm font-medium text-foreground">
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
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Order summary
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              {summaryShape && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Product</dt>
                  <dd className="text-right font-medium text-foreground">
                    {orderProductLineLabel(
                      summaryShape,
                      summaryShape.quantity,
                      sizeUnit,
                    )}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-t border-border pt-2">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="text-base font-semibold tabular-nums text-foreground">
                  {totalLabel}
                </dd>
              </div>
            </dl>
          </section>

          {!isEvent && (
            <p className={orderAlertWarning} role="status">
              Shipping cost and taxes will be calculated based on your details
              and sent to your email with the invoice.
            </p>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              {error}
            </p>
          )}

          {!isSubmittedOrderEdit ? (
            <p className="text-sm text-muted-foreground" role="note">
              Your uploaded photos are stored only as long as needed to fulfil this
              order. Order image files are automatically deleted{" "}
              {LEGAL_RETENTION_DEFAULTS.orderMediaDays} days after fulfilment (see
              our{" "}
              <Link
                href={LEGAL_LINKS.privacy}
                className="text-primary underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </Link>
              ).
            </p>
          ) : null}

          {!isSubmittedOrderEdit ? (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-background p-3">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
                className="mt-0.5"
                required
              />
              <span className="text-sm text-foreground">
                I agree to the{" "}
                <Link href={LEGAL_LINKS.terms} className="text-primary underline" target="_blank">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href={LEGAL_LINKS.privacy} className="text-primary underline" target="_blank">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
          ) : null}

          <button
            type="submit"
            disabled={saving || (!isSubmittedOrderEdit && !consentAccepted)}
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
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
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
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <CustomerPageInner />
    </Suspense>
  );
}
