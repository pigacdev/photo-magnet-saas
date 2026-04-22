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
  normalizeLegacyShippingType,
  type StorefrontShippingType,
} from "@/lib/shippingTypes";

function formatOrderTotal(amount: string, currency: string): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return amount;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.trim() || "EUR",
  }).format(n);
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

function CustomerPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId")?.trim() ?? "";
  const fromSuccess = searchParams.get("from") === "success";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ctx, setCtx] = useState<OrderCustomerLoad | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [shippingType, setShippingType] =
    useState<StorefrontShippingType>("delivery");
  const [fullAddress, setFullAddress] = useState("");
  const [addressNotes, setAddressNotes] = useState("");
  const [lockerId, setLockerId] = useState("");
  /**
   * Live URL query for “Back to review”. Next `useSearchParams()` can omit or
   * lag behind the real address bar — use `window.location.search` and always
   * ensure `orderId` is present when we have it in scope.
   */
  const [liveQueryForReviewBack, setLiveQueryForReviewBack] = useState("");

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search.replace(/^\?/, ""));
    if (orderId) {
      p.set("orderId", orderId);
    }
    setLiveQueryForReviewBack(p.toString());
  }, [orderId, searchParams]);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
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
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load order");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!orderId || !ctx) return;
      setError("");
      setSaving(true);
      try {
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
          router.push(`/order/confirmation${q}`);
        } else {
          const p = new URLSearchParams(q.replace(/^\?/, ""));
          p.set("orderId", orderId);
          router.push(`/order/payment?${p.toString()}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save");
      } finally {
        setSaving(false);
      }
    },
    [
      orderId,
      ctx,
      name,
      phone,
      shippingType,
      fullAddress,
      addressNotes,
      lockerId,
      router,
    ],
  );

  /**
   * Back to review: same query as the live customer URL, with `orderId` guaranteed
   * when `orderId` is set (avoids review pre-commit / duplicate POST).
   */
  const reviewBackHref = useMemo(() => {
    const p = new URLSearchParams(
      liveQueryForReviewBack || searchParams.toString(),
    );
    if (orderId) {
      p.set("orderId", orderId);
    }
    const q = p.toString();
    return `/order/review${q ? `?${q}` : ""}`;
  }, [liveQueryForReviewBack, searchParams, orderId]);

  if (!orderId) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 bg-[#FAFAFA] px-4 py-10">
        <p className="text-sm text-amber-800">Missing order. Return to review and place your order.</p>
        <Link href="/order/review" className="text-sm font-medium text-[#2563EB] underline">
          Back to review
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-sm text-[#6B7280]">
        Loading…
      </div>
    );
  }

  if (error && !ctx) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 bg-[#FAFAFA] px-4 py-10">
        <p className="text-sm text-red-700">{error}</p>
        <Link href={reviewBackHref} className="text-sm font-medium text-[#2563EB] underline">
          Back to review
        </Link>
      </div>
    );
  }

  if (!ctx) return null;

  const isEvent = ctx.contextType === "EVENT";
  const isPaidEdit = ctx.status === "PAID";

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
