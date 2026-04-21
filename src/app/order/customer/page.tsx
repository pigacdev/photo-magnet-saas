"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "@/lib/api";
import { readEventCheckoutCopies } from "@/lib/eventCheckoutSessionBridge";
import { sortMagnetImagesByPosition } from "@/lib/magnetImageSort";
import { getSafeOrderReturnTo } from "@/lib/orderReturnTo";
import type {
  CatalogPricing,
  GetSessionImagesResponse,
  GetSessionResponse,
  OrderSessionPayload,
  PostOrderCommitResponse,
  SessionImage,
} from "@/lib/orderSessionTypes";
import {
  normalizeLegacyShippingType,
  type StorefrontShippingType,
} from "@/lib/shippingTypes";

type EventPaymentMethodChoice = "CASH" | "CARD" | "STRIPE";

function formatOrderTotal(amount: string, currency: string): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return amount;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.trim() || "EUR",
  }).format(n);
}

function hasFullCrop(img: SessionImage): boolean {
  return (
    img.cropX != null &&
    img.cropY != null &&
    img.cropWidth != null &&
    img.cropHeight != null &&
    img.cropWidth >= 1 &&
    img.cropHeight >= 1
  );
}

type OrderCustomerLoad = {
  orderId: string;
  status: string;
  contextType: "EVENT" | "STOREFRONT";
  customerName: string | null;
  customerPhone: string | null;
  shippingType: string | null;
  shippingAddress: unknown | null;
  totalPrice: string;
  currency: string;
  imageCount: number;
  paymentMethod?: string | null;
  eventPaymentOptions?: {
    paymentCashEnabled: boolean;
    paymentCardEnabled: boolean;
    paymentStripeEnabled: boolean;
  } | null;
};

type EventPreflight = {
  session: OrderSessionPayload;
  images: SessionImage[];
  pricing: CatalogPricing[];
  copiesByImageId: Record<string, number>;
};

function EventPaymentSelector(props: {
  options: {
    paymentCashEnabled: boolean;
    paymentCardEnabled: boolean;
    paymentStripeEnabled: boolean;
  } | null;
  selected: EventPaymentMethodChoice | null;
  onChange: (v: EventPaymentMethodChoice) => void;
}) {
  const { options, selected, onChange } = props;
  const hasAny =
    options != null &&
    (options.paymentCashEnabled ||
      options.paymentCardEnabled ||
      options.paymentStripeEnabled);
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-[#111111]">Payment</h2>
      <p className="mt-1 text-xs text-[#6B7280]">
        Choose how you will pay for this order.
      </p>
      {!hasAny ? (
        <p className="mt-3 text-sm text-amber-800">
          Payment options are not available for this event. Contact the
          organizer.
        </p>
      ) : (
        <fieldset className="mt-4 space-y-3">
          <legend className="sr-only">Payment method</legend>
          {options?.paymentCashEnabled && (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-[#FAFAFA] px-3 py-3 has-[:checked]:border-[#2563EB] has-[:checked]:bg-[#EFF6FF]">
              <input
                type="radio"
                name="eventPayment"
                className="mt-1"
                checked={selected === "CASH"}
                onChange={() => onChange("CASH")}
              />
              <span>
                <span className="block text-sm font-medium text-[#111111]">
                  Cash
                </span>
                <span className="text-xs text-[#6B7280]">
                  Pay with cash at the event
                </span>
              </span>
            </label>
          )}
          {options?.paymentCardEnabled && (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-[#FAFAFA] px-3 py-3 has-[:checked]:border-[#2563EB] has-[:checked]:bg-[#EFF6FF]">
              <input
                type="radio"
                name="eventPayment"
                className="mt-1"
                checked={selected === "CARD"}
                onChange={() => onChange("CARD")}
              />
              <span>
                <span className="block text-sm font-medium text-[#111111]">
                  Card on location
                </span>
                <span className="text-xs text-[#6B7280]">
                  Pay by card at the POS at the event
                </span>
              </span>
            </label>
          )}
          {options?.paymentStripeEnabled && (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-[#FAFAFA] px-3 py-3 has-[:checked]:border-[#2563EB] has-[:checked]:bg-[#EFF6FF]">
              <input
                type="radio"
                name="eventPayment"
                className="mt-1"
                checked={selected === "STRIPE"}
                onChange={() => onChange("STRIPE")}
              />
              <span>
                <span className="block text-sm font-medium text-[#111111]">
                  Pay online
                </span>
                <span className="text-xs text-[#6B7280]">
                  Secure card payment (Stripe) before you arrive
                </span>
              </span>
            </label>
          )}
        </fieldset>
      )}
    </section>
  );
}

function preflightSummary(
  session: OrderSessionPayload,
  pricing: CatalogPricing[],
  images: SessionImage[],
  copiesByImageId: Record<string, number>,
): {
  imageCount: number;
  totalPrice: string;
  currency: string;
  totalMagnets: number;
} {
  const currency = pricing[0]?.currency ?? "EUR";
  if (session.pricingType === "per_item") {
    const row = pricing.find((p) => p.type === "per_item");
    const unit = row != null ? Number(row.price) : 0;
    let tm = 0;
    for (const img of images) {
      tm += copiesByImageId[img.id] ?? 1;
    }
    const total = Math.round(tm * unit * 100) / 100;
    return {
      imageCount: images.length,
      totalPrice: total.toFixed(2),
      currency,
      totalMagnets: tm,
    };
  }
  const tp = session.totalPrice;
  return {
    imageCount: images.length,
    totalPrice: tp != null ? String(tp) : "0",
    currency,
    totalMagnets: images.length,
  };
}

function CustomerPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId")?.trim() ?? "";
  const fromSuccess = searchParams.get("from") === "success";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ctx, setCtx] = useState<OrderCustomerLoad | null>(null);
  const [preflight, setPreflight] = useState<EventPreflight | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [shippingType, setShippingType] =
    useState<StorefrontShippingType>("delivery");
  const [fullAddress, setFullAddress] = useState("");
  const [addressNotes, setAddressNotes] = useState("");
  const [lockerId, setLockerId] = useState("");
  const [eventPaymentMethod, setEventPaymentMethod] =
    useState<EventPaymentMethodChoice | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError("");
      setPreflight(null);

      if (orderId) {
        setCtx(null);
        try {
          const o = await api<OrderCustomerLoad>(
            `/api/orders/${encodeURIComponent(orderId)}`,
          );
          if (cancelled) return;
          setCtx(o);
          if (o.customerName) setName(o.customerName);
          if (o.customerPhone) setPhone(o.customerPhone);
          if (o.shippingType) {
            setShippingType(normalizeLegacyShippingType(o.shippingType));
          }
          const addr = o.shippingAddress;
          if (addr && typeof addr === "object" && !Array.isArray(addr)) {
            const fa = (addr as { fullAddress?: unknown }).fullAddress;
            if (typeof fa === "string") setFullAddress(fa);
            const n = (addr as { notes?: unknown }).notes;
            if (typeof n === "string") setAddressNotes(n);
            const lid = (addr as { lockerId?: unknown }).lockerId;
            if (typeof lid === "string") setLockerId(lid);
          }
          // Prefill event payment method from persisted order. If the stored
          // method isn't currently enabled, fall back to the first enabled
          // option on the event (never leave the radio group in a stale state).
          if (o.contextType === "EVENT") {
            const opts = o.eventPaymentOptions;
            const enabled: EventPaymentMethodChoice[] = [];
            if (opts?.paymentCashEnabled) enabled.push("CASH");
            if (opts?.paymentCardEnabled) enabled.push("CARD");
            if (opts?.paymentStripeEnabled) enabled.push("STRIPE");
            const stored = (o.paymentMethod ?? "").toUpperCase() as
              | EventPaymentMethodChoice
              | "";
            if (stored && enabled.includes(stored as EventPaymentMethodChoice)) {
              setEventPaymentMethod(stored as EventPaymentMethodChoice);
            } else if (enabled.length === 1) {
              setEventPaymentMethod(enabled[0]!);
            } else {
              setEventPaymentMethod(null);
            }
          }
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Could not load order");
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      setCtx(null);
      try {
        const params = new URLSearchParams(
          typeof window !== "undefined" ? window.location.search : "",
        );
        const fallback =
          getSafeOrderReturnTo(params.get("returnTo")) ?? "/";
        const orderHref = `/order${params.toString() ? `?${params.toString()}` : ""}`;
        const cropHref = `/order/crop${params.toString() ? `?${params.toString()}` : ""}`;
        const photosHref = `/order/photos${params.toString() ? `?${params.toString()}` : ""}`;
        const reviewHref = `/order/review${params.toString() ? `?${params.toString()}` : ""}`;

        const [sessionRes, imagesRes] = await Promise.all([
          api<GetSessionResponse>("/api/session"),
          api<GetSessionImagesResponse>("/api/session/images"),
        ]);
        if (cancelled) return;

        if (!sessionRes.session) {
          window.location.replace(fallback);
          return;
        }
        if (imagesRes.error === "SESSION_INVALID") {
          window.location.replace(fallback);
          return;
        }

        const sess = sessionRes.session;
        if (sess.contextType !== "event") {
          if (!cancelled) {
            setError(
              "Missing order. Return from review after placing your order.",
            );
            setLoading(false);
          }
          return;
        }

        if (sess.status === "converted" && sess.orderId) {
          const p = new URLSearchParams(params.toString());
          p.set("orderId", sess.orderId);
          router.replace(`/order/customer?${p.toString()}`);
          return;
        }

        if (!sess.selectedShapeId) {
          router.replace(orderHref);
          return;
        }

        const sorted = sortMagnetImagesByPosition(imagesRes.images);
        if (sorted.length === 0) {
          router.replace(photosHref);
          return;
        }
        if (!sorted.every(hasFullCrop)) {
          router.replace(cropHref);
          return;
        }

        const copiesByImageId = readEventCheckoutCopies(
          sess.id,
          sorted.map((i) => i.id),
        );

        if (!cancelled) {
          setPreflight({
            session: sess,
            images: sorted,
            pricing: sessionRes.pricing,
            copiesByImageId,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load checkout");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId, router]);

  useEffect(() => {
    if (!preflight) {
      setEventPaymentMethod(null);
      return;
    }
    const o = preflight.session.eventPaymentOptions;
    if (!o) {
      setEventPaymentMethod(null);
      return;
    }
    const enabled: EventPaymentMethodChoice[] = [];
    if (o.paymentCashEnabled) enabled.push("CASH");
    if (o.paymentCardEnabled) enabled.push("CARD");
    if (o.paymentStripeEnabled) enabled.push("STRIPE");
    if (enabled.length === 0) {
      setEventPaymentMethod(null);
      return;
    }
    if (enabled.length === 1) {
      setEventPaymentMethod(enabled[0]!);
      return;
    }
    setEventPaymentMethod((prev) =>
      prev != null && enabled.includes(prev) ? prev : null,
    );
  }, [preflight]);

  const preflightTotals = useMemo(() => {
    if (!preflight) return null;
    return preflightSummary(
      preflight.session,
      preflight.pricing,
      preflight.images,
      preflight.copiesByImageId,
    );
  }, [preflight]);

  /**
   * Event payment options — from the preflight session (pre-commit) OR the
   * committed order (post-commit, when returning from /order/payment). This
   * lets us render the selector in both entry points.
   */
  const eventPayOpts =
    preflight?.session.eventPaymentOptions ?? ctx?.eventPaymentOptions ?? null;
  const eventHasPaymentConfig =
    eventPayOpts != null &&
    (eventPayOpts.paymentCashEnabled ||
      eventPayOpts.paymentCardEnabled ||
      eventPayOpts.paymentStripeEnabled);
  const eventPaymentChosen =
    eventPaymentMethod != null &&
    ((eventPaymentMethod === "CASH" && eventPayOpts?.paymentCashEnabled) ||
      (eventPaymentMethod === "CARD" && eventPayOpts?.paymentCardEnabled) ||
      (eventPaymentMethod === "STRIPE" && eventPayOpts?.paymentStripeEnabled));

  /**
   * Event order in a state where the buyer may still change payment type.
   * Covers both status codes that mean "unpaid" (Stripe vs cash/card commit
   * originally chose different status enums). Storefront is unaffected.
   */
  const isEditableEventPendingPayment =
    ctx?.contextType === "EVENT" &&
    !!orderId &&
    (ctx.status === "PENDING_PAYMENT" || ctx.status === "PENDING_CASH");

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setSaving(true);

      try {
        if (preflight && preflightTotals && !orderId) {
          if (!eventHasPaymentConfig) {
            setError(
              "Payment options are not available for this event. Contact the organizer.",
            );
            setSaving(false);
            return;
          }
          if (!eventPaymentChosen || !eventPaymentMethod) {
            setError("Choose how you will pay.");
            setSaving(false);
            return;
          }
          const cap = preflight.session.maxMagnetsAllowed ?? 9999;
          if (preflightTotals.totalMagnets > cap) {
            setError(
              `Too many magnets for this order (max ${cap}). Go back to review to adjust.`,
            );
            setSaving(false);
            return;
          }

          const commitBody: Record<string, unknown> = {
            paymentMethod: eventPaymentMethod,
          };
          if (preflight.session.pricingType === "per_item") {
            commitBody.imageCopies = preflight.images.map((img) => ({
              imageId: img.id,
              copies: preflight.copiesByImageId[img.id] ?? 1,
            }));
          }

          const result = await api<PostOrderCommitResponse>("/api/orders", {
            method: "POST",
            body: commitBody,
          });

          const newOrderId = result.orderId;
          const custBody = {
            customerName: name.trim(),
            ...(phone.trim() ? { customerPhone: phone.trim() } : {}),
          };
          await api<{ ok: boolean }>(
            `/api/orders/${encodeURIComponent(newOrderId)}/customer`,
            { method: "PATCH", body: custBody },
          );

          const q =
            typeof window !== "undefined" ? window.location.search : "";
          if (result.status === "PENDING_PAYMENT") {
            const p = new URLSearchParams(q.replace(/^\?/, ""));
            p.set("orderId", newOrderId);
            router.push(`/order/payment?${p.toString()}`);
          } else {
            router.push(`/order/confirmation${q}`);
          }
          return;
        }

        if (!orderId || !ctx) return;

        const body =
          ctx.contextType === "EVENT"
            ? {
                customerName: name.trim(),
                ...(phone.trim() ? { customerPhone: phone.trim() } : {}),
              }
            : shippingType === "pickup"
              ? {
                  customerName: name.trim(),
                  customerPhone: phone.trim(),
                  shippingType: "pickup",
                  shippingAddress: null,
                }
              : shippingType === "delivery"
                ? {
                    customerName: name.trim(),
                    customerPhone: phone.trim(),
                    shippingType: "delivery",
                    shippingAddress: {
                      fullAddress: fullAddress.trim(),
                      notes: addressNotes.trim(),
                    },
                  }
                : {
                    customerName: name.trim(),
                    customerPhone: phone.trim(),
                    shippingType: "boxnow",
                    shippingAddress: { lockerId: lockerId.trim() },
                  };
        await api<{ ok: boolean }>(
          `/api/orders/${encodeURIComponent(orderId)}/customer`,
          { method: "PATCH", body },
        );
        if (ctx.status === "PAID") {
          router.push(
            `/order/success?orderId=${encodeURIComponent(orderId)}`,
          );
          return;
        }
        const q =
          typeof window !== "undefined" ? window.location.search : "";
        if (ctx.contextType === "EVENT") {
          // Editable PENDING_PAYMENT/PENDING_CASH: persist the (possibly
          // changed) payment method without touching images/copies/totals.
          // The server also updates status to mirror the chosen method so the
          // Stripe checkout guard stays correct (PENDING_PAYMENT required).
          if (isEditableEventPendingPayment) {
            if (!eventHasPaymentConfig || !eventPaymentChosen || !eventPaymentMethod) {
              setError("Choose how you will pay.");
              return;
            }
            await api<{ ok: boolean }>(
              `/api/orders/${encodeURIComponent(orderId)}/payment-method`,
              { method: "PATCH", body: { paymentMethod: eventPaymentMethod } },
            );
            const p = new URLSearchParams(q.replace(/^\?/, ""));
            p.set("orderId", orderId);
            if (eventPaymentMethod === "STRIPE") {
              router.push(`/order/payment?${p.toString()}`);
            } else {
              router.push(`/order/confirmation?${p.toString()}`);
            }
          } else if (ctx.status === "PENDING_PAYMENT") {
            const p = new URLSearchParams(q.replace(/^\?/, ""));
            p.set("orderId", orderId);
            router.push(`/order/payment?${p.toString()}`);
          } else {
            router.push(`/order/confirmation${q}`);
          }
        } else {
          const p = new URLSearchParams(q.replace(/^\?/, ""));
          p.set("orderId", orderId);
          router.push(`/order/payment?${p.toString()}`);
        }
      } catch (err) {
        const code =
          err && typeof err === "object" && "code" in err
            ? (err as { code?: string }).code
            : undefined;
        if (
          code === "ORDER_LIMIT_REACHED" ||
          (err instanceof Error && err.message.includes("ORDER_LIMIT_REACHED"))
        ) {
          router.push(`/order/unavailable${window.location.search}`);
          return;
        }
        setError(err instanceof Error ? err.message : "Could not save");
      } finally {
        setSaving(false);
      }
    },
    [
      orderId,
      ctx,
      preflight,
      preflightTotals,
      name,
      phone,
      shippingType,
      fullAddress,
      addressNotes,
      lockerId,
      router,
      eventHasPaymentConfig,
      eventPaymentChosen,
      eventPaymentMethod,
      isEditableEventPendingPayment,
    ],
  );

  /**
   * Back to review — same behavior for storefront and event.
   * Preserves all checkout params (orderId, returnTo, eventSlug, session params).
   * Only strips clearly transient flags that should never persist across steps.
   */
  const reviewHref = useMemo(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("from");
    p.delete("success");
    p.delete("canceled");
    const q = p.toString();
    return `/order/review${q ? `?${q}` : ""}`;
  }, [searchParams]);

  const onBackToReview = useCallback(() => {
    // Pure router navigation: do not clear sessionStorage, payment method,
    // shipping selection, or the event copy bridge.
    router.push(reviewHref);
  }, [router, reviewHref]);

  const backToReviewLinkClass =
    "text-sm font-medium text-[#2563EB] underline-offset-4 hover:underline";
  const backToReviewEventButtonClass = `inline border-0 bg-transparent p-0 text-left ${backToReviewLinkClass}`;

  const pageShellClass =
    "min-h-screen bg-[#FAFAFA] pb-16 pt-8";
  const innerClass = "mx-auto max-w-lg px-4";

  if (loading) {
    return (
      <div className={pageShellClass}>
        <div className={`${innerClass} text-sm text-[#6B7280]`}>
          Loading…
        </div>
      </div>
    );
  }

  if (!orderId && error && !preflight) {
    return (
      <div className={pageShellClass}>
        <div className={`${innerClass} flex flex-col gap-4`}>
          <p className="text-sm text-amber-800">{error}</p>
          <button
            type="button"
            className={backToReviewEventButtonClass}
            onClick={onBackToReview}
          >
            Back to review
          </button>
        </div>
      </div>
    );
  }

  if (!orderId && preflight && preflightTotals) {
    const isPerItem = preflight.session.pricingType === "per_item";
    return (
      <div className={pageShellClass}>
        <div className={`${innerClass} flex flex-col gap-6`}>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
              Your details
            </h1>
            <p className="mt-2 text-sm text-[#6B7280]">
              We use this for your order at the event. Choose payment below,
              then complete your order.
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              Order summary
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[#6B7280]">Photos</dt>
                <dd className="text-right font-medium text-[#111111] tabular-nums">
                  {preflightTotals.imageCount === 1
                    ? "1 photo"
                    : `${preflightTotals.imageCount} photos`}
                </dd>
              </div>
              {isPerItem && (
                <div className="flex justify-between gap-4">
                  <dt className="text-[#6B7280]">Total magnets</dt>
                  <dd className="text-right font-medium text-[#111111] tabular-nums">
                    {preflightTotals.totalMagnets}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-t border-gray-100 pt-2">
                <dt className="text-[#6B7280]">Total</dt>
                <dd className="text-base font-semibold tabular-nums text-[#111111]">
                  {formatOrderTotal(
                    preflightTotals.totalPrice,
                    preflightTotals.currency,
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <form
            onSubmit={(e) => void onSubmit(e)}
            className="flex flex-col gap-4"
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#111111]">
                Full name <span className="text-red-600">*</span>
              </span>
              <input
                type="text"
                name="name"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#111111] outline-none ring-[#2563EB] focus:ring-2"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#111111]">Phone</span>
              <input
                type="tel"
                name="phone"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#111111] outline-none ring-[#2563EB] focus:ring-2"
              />
              <span className="text-xs text-[#6B7280]">Optional</span>
            </label>

            <EventPaymentSelector
              options={eventPayOpts}
              selected={eventPaymentMethod}
              onChange={setEventPaymentMethod}
            />

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={
                saving ||
                !eventHasPaymentConfig ||
                !eventPaymentChosen
              }
              className="mt-2 w-full rounded-2xl bg-[#2563EB] py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Placing order…" : "Complete order"}
            </button>
          </form>

          <button
            type="button"
            className={backToReviewEventButtonClass}
            onClick={onBackToReview}
          >
            Back to review
          </button>
        </div>
      </div>
    );
  }

  if (!orderId) {
    return (
      <div className={pageShellClass}>
        <div className={`${innerClass} flex flex-col gap-4`}>
          <p className="text-sm text-amber-800">
            Could not start checkout. Return to review and continue from there.
          </p>
          <button
            type="button"
            className={backToReviewEventButtonClass}
            onClick={onBackToReview}
          >
            Back to review
          </button>
        </div>
      </div>
    );
  }

  if (error && !ctx) {
    return (
      <div className={pageShellClass}>
        <div className={`${innerClass} flex flex-col gap-4`}>
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            className={backToReviewEventButtonClass}
            onClick={onBackToReview}
          >
            Back to review
          </button>
        </div>
      </div>
    );
  }

  if (!ctx) return null;

  const isEvent = ctx.contextType === "EVENT";
  const isPaidEdit = ctx.status === "PAID";

  return (
    <div className={pageShellClass}>
      <div className={`${innerClass} flex flex-col gap-6`}>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
            {isPaidEdit
              ? fromSuccess
                ? "Update your details"
                : "Your details"
              : "Your details"}
          </h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            {isPaidEdit
              ? "Fix typos in name, phone, address, or locker id. Your order and payment stay the same."
              : isEvent
                ? "We use this for your order at the event."
                : "Choose how you receive your order. Delivery needs an address; BoxNow needs a locker id."}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
            Order summary
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[#6B7280]">Photos</dt>
              <dd className="text-right font-medium text-[#111111] tabular-nums">
                {ctx.imageCount === 1 ? "1 photo" : `${ctx.imageCount} photos`}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-gray-100 pt-2">
              <dt className="text-[#6B7280]">Total</dt>
              <dd className="text-base font-semibold tabular-nums text-[#111111]">
                {formatOrderTotal(ctx.totalPrice, ctx.currency)}
              </dd>
            </div>
          </dl>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#111111]">
              Full name <span className="text-red-600">*</span>
            </span>
            <input
              type="text"
              name="name"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#111111] outline-none ring-[#2563EB] focus:ring-2"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#111111]">
              Phone
              {!isEvent && <span className="text-red-600"> *</span>}
            </span>
            <input
              type="tel"
              name="phone"
              autoComplete="tel"
              required={!isEvent}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#111111] outline-none ring-[#2563EB] focus:ring-2"
            />
            {isEvent && (
              <span className="text-xs text-[#6B7280]">Optional</span>
            )}
          </label>

          {!isEvent && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-[#111111]">
                  Shipping method <span className="text-red-600">*</span>
                </span>
                <select
                  name="shippingType"
                  required
                  value={shippingType}
                  onChange={(e) =>
                    setShippingType(e.target.value as StorefrontShippingType)
                  }
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#111111] outline-none ring-[#2563EB] focus:ring-2"
                >
                  <option value="pickup">Pickup</option>
                  <option value="delivery">Delivery</option>
                  <option value="boxnow">BoxNow</option>
                </select>
              </label>
              {shippingType === "delivery" && (
                <>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-[#111111]">
                      Delivery address <span className="text-red-600">*</span>
                    </span>
                    <textarea
                      name="fullAddress"
                      required
                      rows={4}
                      value={fullAddress}
                      onChange={(e) => setFullAddress(e.target.value)}
                      placeholder="Street, city, postal code, country"
                      className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#111111] outline-none ring-[#2563EB] focus:ring-2"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-[#111111]">
                      Delivery notes
                    </span>
                    <textarea
                      name="addressNotes"
                      rows={2}
                      value={addressNotes}
                      onChange={(e) => setAddressNotes(e.target.value)}
                      placeholder="Apartment, gate code, delivery instructions (optional)"
                      className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#111111] outline-none ring-[#2563EB] focus:ring-2"
                    />
                  </label>
                </>
              )}
              {shippingType === "boxnow" && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-[#111111]">
                    BoxNow locker id <span className="text-red-600">*</span>
                  </span>
                  <input
                    type="text"
                    name="lockerId"
                    required
                    autoComplete="off"
                    value={lockerId}
                    onChange={(e) => setLockerId(e.target.value)}
                    placeholder="Locker or pickup point id from BoxNow"
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#111111] outline-none ring-[#2563EB] focus:ring-2"
                  />
                </label>
              )}
            </>
          )}

          {/*
            Event PENDING_PAYMENT / PENDING_CASH: render payment options so
            the buyer can change type when coming back from /order/payment.
            Storefront is untouched.
          */}
          {isEvent && isEditableEventPendingPayment && (
            <EventPaymentSelector
              options={eventPayOpts}
              selected={eventPaymentMethod}
              onChange={setEventPaymentMethod}
            />
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={
              saving ||
              (isEvent &&
                isEditableEventPendingPayment &&
                (!eventHasPaymentConfig || !eventPaymentChosen))
            }
            className="mt-2 w-full rounded-2xl bg-[#2563EB] py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving
              ? "Saving…"
              : isPaidEdit
                ? "Save changes"
                : isEvent
                  ? isEditableEventPendingPayment
                    ? eventPaymentMethod === "STRIPE"
                      ? "Continue to payment"
                      : "Complete order"
                    : "Continue"
                  : "Continue to payment"}
          </button>
        </form>

        {/* Back to review — same behavior for storefront and event. */}
        <button
          type="button"
          className={backToReviewEventButtonClass}
          onClick={onBackToReview}
        >
          Back to review
        </button>
      </div>
    </div>
  );
}

export default function OrderCustomerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAFAFA] pb-16 pt-8">
          <div className="mx-auto max-w-lg px-4 text-sm text-[#6B7280]">
            Loading…
          </div>
        </div>
      }
    >
      <CustomerPageInner />
    </Suspense>
  );
}
