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
import {
  CHECKOUT_IMAGE_COPIES_STORAGE_KEY,
  type GetSessionImagesResponse,
  type GetSessionResponse,
  type PostOrderFinalizeResponse,
  type PostSessionCheckoutCustomerResponse,
  type PostStripeSessionCheckoutResponse,
} from "@/lib/orderSessionTypes";
import {
  normalizeLegacyShippingType,
  type StorefrontShippingType,
} from "@/lib/shippingTypes";
import { sortMagnetImagesByPosition } from "@/lib/magnetImageSort";
import { readCheckoutImageCopies } from "@/lib/checkoutImageCopiesStorage";

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
};

type SessionCheckoutSummary = {
  contextType: "event" | "storefront";
  totalPrice: number | null;
  currency: string;
  imageCount: number;
  /** Per-item: totals aligned with review using session + sessionStorage copy counts. */
  perItemSummary: { totalMagnets: number; lineTotal: number } | null;
};

/** Values accepted by POST /api/orders/finalize (event); matches server resolveOrderStatusForFinalization. */
type EventPaymentMethod = "cash" | "card_on_location" | "stripe";

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

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [shippingType, setShippingType] =
    useState<StorefrontShippingType>("delivery");
  const [fullAddress, setFullAddress] = useState("");
  const [addressNotes, setAddressNotes] = useState("");
  const [lockerId, setLockerId] = useState("");
  /** Event session checkout: how the customer will pay (passed to finalize as paymentMethod). */
  const [eventPaymentMethod, setEventPaymentMethod] =
    useState<EventPaymentMethod>("cash");
  /** Query for “Back to review” — no orderId (session-based checkout). */
  const [liveQueryForReviewBack, setLiveQueryForReviewBack] = useState("");

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search.replace(/^\?/, ""));
    p.delete("orderId");
    setLiveQueryForReviewBack(p.toString());
  }, [searchParams]);

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
        setOrderCtx(null);
        setSessionCtx({
          contextType: sessionRes.session.contextType,
          totalPrice: sessionRes.session.totalPrice,
          currency,
          imageCount: sorted.length,
          perItemSummary: isPer ? { totalMagnets, lineTotal } : null,
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

  const isPaidEdit = orderCtx?.status === "PAID";

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
          if (orderCtx.status === "PAID") {
            router.push(
              `/order/success?orderId=${encodeURIComponent(orderId)}`,
            );
            return;
          }
          const q =
            typeof window !== "undefined" ? window.location.search : "";
          if (orderCtx.contextType === "EVENT") {
            const p = new URLSearchParams(q.replace(/^\?/, ""));
            p.set("orderId", orderId);
            router.push(
              `/order/confirmation?${p.toString()}`,
            );
            return;
          }
          const p = new URLSearchParams(q.replace(/^\?/, ""));
          p.set("orderId", orderId);
          router.push(`/order/payment?${p.toString()}`);
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
          customerName: name.trim(),
        };
        if (isEvent) {
          if (phone.trim()) customerOnly.phone = phone.trim();
        } else {
          customerOnly.phone = phone.trim();
          if (shippingType === "pickup") {
            customerOnly.shippingType = "pickup";
            customerOnly.shippingAddress = null;
          } else if (shippingType === "delivery") {
            customerOnly.shippingType = "delivery";
            customerOnly.shippingAddress = {
              fullAddress: fullAddress.trim(),
              notes: addressNotes.trim(),
            };
          } else {
            customerOnly.shippingType = "boxnow";
            customerOnly.shippingAddress = { lockerId: lockerId.trim() };
          }
        }

        const isStripeSessionFlow = !isEvent || eventPaymentMethod === "stripe";
        if (isStripeSessionFlow) {
          await api<PostSessionCheckoutCustomerResponse>(
            "/api/session/checkout/customer",
            { method: "POST", body: customerOnly },
          );
          const scBody: Record<string, unknown> = { paymentMethod: "stripe" };
          const copyRows = readCheckoutImageCopies();
          if (copyRows.length > 0) {
            scBody.imageCopies = copyRows;
          }
          const stripeRes = await api<PostStripeSessionCheckoutResponse>(
            "/api/stripe/session-checkout",
            { method: "POST", body: scBody },
          );
          if (!stripeRes?.url) {
            setError("Could not start payment. Try again.");
            return;
          }
          if (typeof window !== "undefined") {
            window.location.assign(stripeRes.url);
          }
          return;
        }

        const paymentMethod = isEvent ? eventPaymentMethod : "stripe";
        const body: Record<string, unknown> = {
          ...customerOnly,
          paymentMethod,
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
        if (isEvent) {
          router.push(`/order/confirmation?${p.toString()}`);
        } else {
          router.push(`/order/payment?${p.toString()}`);
        }
      } catch (err) {
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
      isPaidEdit,
      eventPaymentMethod,
      name,
      phone,
      shippingType,
      fullAddress,
      addressNotes,
      lockerId,
      router,
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

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-sm text-[#6B7280]">
        Loading…
      </div>
    );
  }

  if (orderId && error && !orderCtx) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 bg-[#FAFAFA] px-4 py-10">
        <p className="text-sm text-red-700">{error}</p>
        <Link
          href={reviewBackHref}
          className="text-sm font-medium text-[#2563EB] underline"
        >
          Back to review
        </Link>
      </div>
    );
  }

  if (!orderId && error && !sessionCtx) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 bg-[#FAFAFA] px-4 py-10">
        <p className="text-sm text-red-700">{error}</p>
        <Link
          href={reviewBackHref}
          className="text-sm font-medium text-[#2563EB] underline"
        >
          Back to review
        </Link>
      </div>
    );
  }

  if (!orderCtx && !sessionCtx) return null;

  const imageCount = orderCtx?.imageCount ?? sessionCtx?.imageCount ?? 0;
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

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 bg-[#FAFAFA] px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-[#111111]">
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
              {imageCount === 1 ? "1 photo" : `${imageCount} photos`}
            </dd>
          </div>
          {!orderCtx && sessionCtx?.perItemSummary && (
            <div className="flex justify-between gap-4">
              <dt className="text-[#6B7280]">Magnets (total)</dt>
              <dd className="text-right font-medium text-[#111111] tabular-nums">
                {sessionCtx.perItemSummary.totalMagnets}
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

        {isEvent && sessionCtx && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#111111]">
              Payment method <span className="text-red-600">*</span>
            </span>
            <select
              name="eventPaymentMethod"
              required
              value={eventPaymentMethod}
              onChange={(e) =>
                setEventPaymentMethod(e.target.value as EventPaymentMethod)
              }
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#111111] outline-none ring-[#2563EB] focus:ring-2"
            >
              <option value="cash">Cash at event</option>
              <option value="card_on_location">Card on location</option>
              <option value="stripe">Pay online (card)</option>
            </select>
          </label>
        )}

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

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="mt-2 w-full rounded-2xl bg-[#2563EB] py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving
            ? "Saving…"
            : isPaidEdit
              ? "Save changes"
              : isEvent
                ? "Continue"
                : "Continue to payment"}
        </button>
      </form>

      <Link
        href={reviewBackHref}
        className="text-sm font-medium text-[#2563EB] underline-offset-4 hover:underline"
      >
        Back to review
      </Link>
    </div>
  );
}

export default function OrderCustomerPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-10 text-sm text-[#6B7280]">
          Loading…
        </div>
      }
    >
      <CustomerPageInner />
    </Suspense>
  );
}
