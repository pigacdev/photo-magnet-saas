"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { MagnetReviewCard } from "@/components/order/MagnetReviewCard";
import { OrderBottomBar } from "@/components/order/OrderBottomBar";
import { OrderShell } from "@/components/order/OrderShell";
import { OrderStepHeader } from "@/components/order/OrderStepHeader";
import { orderAlertError, orderBtnPrimary } from "@/components/order/orderUi";
import { sortMagnetImagesByPosition } from "@/lib/magnetImageSort";
import { getSafeOrderReturnTo } from "@/lib/orderReturnTo";
import { getIsLowResolution } from "@/lib/sessionImageLowResolution";
import type {
  CatalogPricing,
  CatalogShape,
  GetSessionImagesResponse,
  GetSessionResponse,
  OrderSessionPayload,
  PostSessionCheckoutValidateResponse,
  SessionImage,
} from "@/lib/orderSessionTypes";
import {
  buildCopyRowsFromState,
  buildCopiesRecordFromImageIds,
  clearCheckoutImageCopies,
  persistCopyCountsNow,
  writeCheckoutImageCopies,
} from "@/lib/checkoutImageCopiesStorage";
import {
  isBundleMagnetAllocationComplete,
  sumImageCopies,
  usesImageCopies,
} from "@/lib/orderMagnetCounts";

function formatMoney(amount: number | null, currency = "EUR"): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(amount);
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

export default function OrderReviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<OrderSessionPayload | null>(null);
  const [images, setImages] = useState<SessionImage[]>([]);
  const [shapes, setShapes] = useState<CatalogShape[]>([]);
  const [pricing, setPricing] = useState<CatalogPricing[]>([]);
  const [linkSearch, setLinkSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  /** Set after a successful DELETE so empty `images` redirects only post-delete, not during initial load. */
  const [hasDeleted, setHasDeleted] = useState(false);
  const [committing, setCommitting] = useState(false);
  /** Per-magnet pricing: copies per session image id (default 1). */
  const [copiesByImageId, setCopiesByImageId] = useState<Record<string, number>>(
    {},
  );

  const reviewItemRefs = useRef<Map<string, HTMLLIElement | null>>(new Map());

  useEffect(() => {
    setLinkSearch(window.location.search);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fallback = getSafeOrderReturnTo(params.get("returnTo")) ?? "/";
    const orderHref = `/order${params.toString() ? `?${params.toString()}` : ""}`;
    const cropHref = `/order/crop${params.toString() ? `?${params.toString()}` : ""}`;
    const photosHref = `/order/photos${params.toString() ? `?${params.toString()}` : ""}`;

    let cancelled = false;

    void (async () => {
      try {
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
        if (!sessionRes.session.selectedShapeId) {
          router.replace(orderHref);
          return;
        }

        const sorted = sortMagnetImagesByPosition(imagesRes.images);
        if (sorted.length === 0) {
          router.replace(photosHref);
          return;
        }
        const allCropped = sorted.every(hasFullCrop);
        if (!allCropped) {
          router.replace(cropHref);
          return;
        }

        if (!cancelled) {
          setSession(sessionRes.session);
          setImages(sorted);
          setShapes(sessionRes.shapes);
          setPricing(sessionRes.pricing);
        }
      } catch {
        if (cancelled) return;
        window.location.replace(fallback);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  /** Restore from sessionStorage before defaulting; clear when copies not used. */
  useEffect(() => {
    if (!session) return;
    const pricingType = session.pricingType;
    if (!usesImageCopies(pricingType)) {
      setCopiesByImageId({});
      clearCheckoutImageCopies();
      return;
    }
    const ids = images.map((i) => i.id);
    setCopiesByImageId(buildCopiesRecordFromImageIds(ids, pricingType));
  }, [images, session]);

  /** Keep sessionStorage in sync on every copy change (per-item only; bundle is read-only here). */
  useEffect(() => {
    if (!session || session.pricingType !== "per_item" || images.length === 0) {
      return;
    }
    writeCheckoutImageCopies(buildCopyRowsFromState(images, copiesByImageId));
  }, [session, images, copiesByImageId]);

  useEffect(() => {
    if (!hasDeleted) return;
    if (loading) return;
    if (!session) return;
    if (images.length !== 0) return;
    const q =
      linkSearch || (typeof window !== "undefined" ? window.location.search : "");
    router.replace(`/order/photos${q}`);
  }, [hasDeleted, images.length, loading, linkSearch, router, session]);

  /** After returning from crop (edit mode), scroll to the edited row and drop `scrollTo` from the URL. */
  useLayoutEffect(() => {
    if (loading || images.length === 0) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const scrollToId = params.get("scrollTo");
    if (!scrollToId) return;

    const runScroll = () => {
      reviewItemRefs.current
        .get(scrollToId)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
    runScroll();
    requestAnimationFrame(runScroll);

    params.delete("scrollTo");
    const next = params.toString();
    const path = `${window.location.pathname}${next ? `?${next}` : ""}`;
    router.replace(path);
    setLinkSearch(next ? `?${next}` : "");
  }, [loading, images.length, router]);

  const selectedShape = useMemo(() => {
    if (!session?.selectedShapeId) return null;
    return shapes.find((s) => s.id === session.selectedShapeId) ?? null;
  }, [shapes, session?.selectedShapeId]);

  const currency = pricing[0]?.currency ?? "EUR";

  const isPerItemPricing = session?.pricingType === "per_item";
  const isBundlePricing = session?.pricingType === "bundle";
  const pricePerMagnet = useMemo(() => {
    const row = pricing.find((p) => p.type === "per_item");
    return row != null ? Number(row.price) : 0;
  }, [pricing]);

  const { totalMagnets, liveTotalPrice } = useMemo(() => {
    if (!session) {
      return { totalMagnets: 0, liveTotalPrice: null as number | null };
    }
    if (!isPerItemPricing) {
      const tm = sumImageCopies(
        images.map((i) => i.id),
        copiesByImageId,
      );
      return {
        totalMagnets: tm,
        liveTotalPrice: session.totalPrice,
      };
    }
    let tm = 0;
    for (const img of images) {
      tm += copiesByImageId[img.id] ?? 1;
    }
    const live =
      Number.isFinite(pricePerMagnet) && pricePerMagnet >= 0
        ? Math.round(tm * pricePerMagnet * 100) / 100
        : null;
    return { totalMagnets: tm, liveTotalPrice: live };
  }, [session, isPerItemPricing, images, copiesByImageId, pricePerMagnet]);

  const magnetCap = session?.maxMagnetsAllowed ?? 9999;

  const canProceed =
    session != null &&
    images.length >= 1 &&
    images.every(hasFullCrop) &&
    (!isPerItemPricing ||
      (liveTotalPrice != null &&
        liveTotalPrice > 0 &&
        totalMagnets <= magnetCap)) &&
    (!isBundlePricing ||
      isBundleMagnetAllocationComplete(
        session.maxImagesAllowed,
        totalMagnets,
      ));

  const adjustCopies = useCallback(
    (imageId: string, delta: number) => {
      if (!session || !isPerItemPricing) return;
      const cap = session.maxMagnetsAllowed ?? 9999;
      setCopiesByImageId((prev) => {
        const cur = prev[imageId] ?? 1;
        let n = cur + delta;
        if (n < 1) n = 1;
        const others = images
          .filter((i) => i.id !== imageId)
          .reduce((sum, i) => sum + (prev[i.id] ?? 1), 0);
        if (others + n > cap) n = Math.max(1, cap - others);
        return { ...prev, [imageId]: n };
      });
    },
    [session, isPerItemPricing, images],
  );

  const cropEditHref = useCallback(
    (imageId: string) => {
      const p = new URLSearchParams(linkSearch.replace(/^\?/, ""));
      p.set("imageId", imageId);
      return `/order/crop?${p.toString()}`;
    },
    [linkSearch],
  );

  const onCropLinkClick = useCallback(() => {
    const pricingType = session?.pricingType ?? null;
    if (usesImageCopies(pricingType)) {
      persistCopyCountsNow(images, copiesByImageId, pricingType);
    }
  }, [session?.pricingType, images, copiesByImageId]);

  const previewTapFrameClass = useMemo(() => {
    if (!selectedShape) return "rounded-xl";
    return selectedShape.shapeType.toUpperCase() === "CIRCLE"
      ? "rounded-full"
      : "rounded-xl";
  }, [selectedShape]);

  const onDelete = async (id: string) => {
    setActionError("");
    setDeleteId(id);
    try {
      await api<{ success: boolean }>(`/api/session/images/${id}`, {
        method: "DELETE",
      });
      setHasDeleted(true);
      setImages((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setDeleteId(null);
    }
  };

  const onProceed = async () => {
    if (committing) return;
    if (!canProceed) {
      return;
    }
    setActionError("");
    setCommitting(true);
    try {
      const q = linkSearch || window.location.search;
      const pricingType = session?.pricingType ?? null;
      persistCopyCountsNow(images, copiesByImageId, pricingType);
      const copyPayload =
        usesImageCopies(pricingType)
          ? {
              imageCopies: buildCopyRowsFromState(images, copiesByImageId),
            }
          : {};
      await api<PostSessionCheckoutValidateResponse>("/api/session/checkout/validate", {
        method: "POST",
        body: copyPayload,
      });
      const customerParams = new URLSearchParams(q.replace(/^\?/, ""));
      customerParams.delete("orderId");
      const qStr = customerParams.toString();
      router.push(`/order/customer${qStr ? `?${qStr}` : ""}`);
    } catch (e: unknown) {
      const code =
        e && typeof e === "object" && "code" in e
          ? (e as { code?: string }).code
          : undefined;
      if (
        code === "ORDER_LIMIT_REACHED" ||
        (e instanceof Error && e.message.includes("ORDER_LIMIT_REACHED"))
      ) {
        router.push(`/order/unavailable${window.location.search}`);
        return;
      }
      setActionError(
        e instanceof Error ? e.message : "Could not place order. Try again.",
      );
    } finally {
      setCommitting(false);
    }
  };

  if (loading) {
    return (
      <OrderShell
        contentWidth="wide"
        bottomBar={
          <OrderBottomBar contentWidth="wide">
            <div className="mb-2 h-5 w-40 animate-pulse rounded bg-neutral-200" />
            <div className="h-12 w-full animate-pulse rounded-xl bg-neutral-200" />
          </OrderBottomBar>
        }
      >
        <div className="mb-6 h-8 w-48 animate-pulse rounded bg-neutral-200" />
        <div className="grid gap-4 pb-4 md:grid-cols-2">
          {[1, 2].map((k) => (
            <div key={k} className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="mx-auto aspect-[3/4] max-w-md animate-pulse rounded-xl bg-neutral-200" />
              <div className="flex gap-2">
                <div className="h-12 flex-1 animate-pulse rounded-xl bg-neutral-200" />
                <div className="h-12 flex-1 animate-pulse rounded-xl bg-neutral-200" />
              </div>
            </div>
          ))}
        </div>
      </OrderShell>
    );
  }

  if (!session || !selectedShape) {
    return (
      <OrderShell>
        <div className="flex flex-col gap-4 py-2">
          <p className="text-sm text-muted-foreground">Nothing to review.</p>
          <Link href="/order" className="text-sm text-primary underline">
            Back to order
          </Link>
        </div>
      </OrderShell>
    );
  }

  const bottomBar = (
    <OrderBottomBar contentWidth="wide">
      {isPerItemPricing ? (
        <div className="text-center text-sm font-medium text-foreground">
          <p className="tabular-nums">
            Total magnets: {totalMagnets}
            {session != null && totalMagnets > magnetCap
              ? ` (max ${magnetCap})`
              : ""}
          </p>
          <p className="mt-1 tabular-nums">
            Price: {formatMoney(liveTotalPrice, currency)}
          </p>
        </div>
      ) : (
        <p className="text-center text-sm font-medium text-foreground">
          {totalMagnets === 0
            ? `0 magnets · ${formatMoney(session?.totalPrice ?? null, currency)}`
            : `${totalMagnets} magnet${totalMagnets === 1 ? "" : "s"} · ${formatMoney(session?.totalPrice ?? null, currency)}`}
        </p>
      )}
      <button
        type="button"
        disabled={!canProceed || committing}
        onClick={() => void onProceed()}
        className={orderBtnPrimary}
      >
        {committing ? "Continuing…" : "Continue to details"}
      </button>
    </OrderBottomBar>
  );

  return (
    <OrderShell contentWidth="wide" bottomBar={bottomBar}>
      <OrderStepHeader
        title="Review your magnets"
        subtitle="This is what will be printed — adjust crops from here if needed."
        step={{ current: 4, total: 5, label: "Review" }}
      />

      {actionError && (
        <p className={`mb-4 ${orderAlertError}`}>{actionError}</p>
      )}

      <ul className="grid gap-4 pb-4 md:grid-cols-2">
        {images.map((img, i) => (
          <li
            key={img.id}
            ref={(el) => {
              if (el) reviewItemRefs.current.set(img.id, el);
              else reviewItemRefs.current.delete(img.id);
            }}
            className="scroll-mt-4"
          >
            <MagnetReviewCard
              image={img}
              shape={selectedShape}
              index={i}
              cropEditHref={cropEditHref(img.id)}
              onCropLinkClick={onCropLinkClick}
              isLowResolution={getIsLowResolution(img, selectedShape)}
              isPerItemPricing={Boolean(isPerItemPricing && session)}
              showCopyCount={Boolean(isBundlePricing && session)}
              copies={copiesByImageId[img.id] ?? 1}
              magnetCap={magnetCap}
              totalMagnets={totalMagnets}
              onAdjustCopies={(delta) => adjustCopies(img.id, delta)}
              onDelete={() => void onDelete(img.id)}
              deleting={deleteId === img.id}
              previewFrameClass={previewTapFrameClass}
            />
          </li>
        ))}
      </ul>
    </OrderShell>
  );
}
