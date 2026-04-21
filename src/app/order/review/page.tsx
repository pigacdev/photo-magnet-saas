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
import { CroppedShapePreview } from "@/components/order/CroppedShapePreview";
import { sortMagnetImagesByPosition } from "@/lib/magnetImageSort";
import { getSafeOrderReturnTo } from "@/lib/orderReturnTo";
import { getIsLowResolution } from "@/lib/sessionImageLowResolution";
import {
  readEventCheckoutCopies,
  writeEventCheckoutCopies,
} from "@/lib/eventCheckoutSessionBridge";
import type {
  CatalogPricing,
  CatalogShape,
  GetSessionImagesResponse,
  GetSessionResponse,
  OrderSessionPayload,
  PostOrderCommitResponse,
  SessionImage,
} from "@/lib/orderSessionTypes";

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

    // TEMP diagnostic logs: remove once storefront back-to-review is verified stable.
    // eslint-disable-next-line no-console
    console.log("[review] orderId:", params.get("orderId"));

    let cancelled = false;

    void (async () => {
      try {
        const [sessionRes, imagesRes] = await Promise.all([
          api<GetSessionResponse>("/api/session"),
          api<GetSessionImagesResponse>("/api/session/images"),
        ]);
        if (cancelled) return;

        // eslint-disable-next-line no-console
        console.log("[review] session:", sessionRes.session);
        // eslint-disable-next-line no-console
        console.log("[review] imagesRes:", {
          count: imagesRes.images?.length ?? 0,
          error: imagesRes.error,
        });

        if (!sessionRes.session) {
          // eslint-disable-next-line no-console
          console.log("[review] redirecting to fallback (no session):", fallback);
          window.location.replace(fallback);
          return;
        }
        if (imagesRes.error === "SESSION_INVALID") {
          // eslint-disable-next-line no-console
          console.log(
            "[review] redirecting to fallback (images SESSION_INVALID):",
            fallback,
          );
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
        if (!cancelled) window.location.replace(fallback);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (images.length === 0) return;

    if (
      session?.contextType === "event" &&
      session.pricingType === "per_item"
    ) {
      const fromStorage = readEventCheckoutCopies(
        session.id,
        images.map((i) => i.id),
      );
      setCopiesByImageId((prev) => {
        const next: Record<string, number> = {};
        for (const img of images) {
          const stored = fromStorage[img.id];
          next[img.id] =
            typeof stored === "number" && stored >= 1
              ? stored
              : (prev[img.id] ?? 1);
        }
        return next;
      });
      return;
    }

    setCopiesByImageId((prev) => {
      const next: Record<string, number> = { ...prev };
      for (const img of images) {
        if (next[img.id] == null) next[img.id] = 1;
      }
      for (const id of Object.keys(next)) {
        if (!images.some((i) => i.id === id)) delete next[id];
      }
      return next;
    });
  }, [images, session?.id, session?.contextType, session?.pricingType]);

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
  const pricePerMagnet = useMemo(() => {
    const row = pricing.find((p) => p.type === "per_item");
    return row != null ? Number(row.price) : 0;
  }, [pricing]);

  const { totalMagnets, liveTotalPrice } = useMemo(() => {
    if (!session) {
      return { totalMagnets: 0, liveTotalPrice: null as number | null };
    }
    if (!isPerItemPricing) {
      return {
        totalMagnets: images.length,
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
  }, [
    session,
    isPerItemPricing,
    images,
    copiesByImageId,
    pricePerMagnet,
  ]);

  const magnetCap = session?.maxMagnetsAllowed ?? 9999;

  const isEventSession = session?.contextType === "event";

  const canProceed =
    images.length >= 1 &&
    images.every(hasFullCrop) &&
    session != null &&
    (!isPerItemPricing ||
      (liveTotalPrice != null &&
        liveTotalPrice > 0 &&
        totalMagnets <= magnetCap));

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
    if (!canProceed || committing) return;
    setActionError("");
    setCommitting(true);
    const q = linkSearch || window.location.search;
    try {
      if (session.contextType === "event") {
        if (session.pricingType === "per_item") {
          writeEventCheckoutCopies(session.id, {
            imageCopies: images.map((img) => ({
              imageId: img.id,
              copies: copiesByImageId[img.id] ?? 1,
            })),
          });
        }
        const customerParams = new URLSearchParams(q.replace(/^\?/, ""));
        customerParams.delete("orderId");
        const qs = customerParams.toString();
        router.push(`/order/customer${qs ? `?${qs}` : ""}`);
        return;
      }

      const commitBody: Record<string, unknown> = {};
      if (session.pricingType === "per_item") {
        commitBody.imageCopies = images.map((img) => ({
          imageId: img.id,
          copies: copiesByImageId[img.id] ?? 1,
        }));
      }
      const result = await api<PostOrderCommitResponse>("/api/orders", {
        method: "POST",
        body: commitBody,
      });
      const customerParams = new URLSearchParams(q.replace(/^\?/, ""));
      customerParams.set("orderId", result.orderId);
      router.push(`/order/customer?${customerParams.toString()}`);
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
      <div className="min-h-screen bg-[#FAFAFA] pb-36">
        <div className="mx-auto max-w-lg px-4 pt-8">
          <div className="mb-6 h-8 w-48 animate-pulse rounded bg-neutral-200" />
          <div className="mb-10 space-y-8">
            {[1, 2].map((k) => (
              <div key={k} className="space-y-3">
                <div className="mx-auto aspect-[3/4] max-w-md animate-pulse rounded-xl bg-neutral-200" />
                <div className="flex gap-3">
                  <div className="h-12 flex-1 animate-pulse rounded-2xl bg-neutral-200" />
                  <div className="h-12 flex-1 animate-pulse rounded-2xl bg-neutral-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="mx-auto max-w-lg">
            <div className="mb-2 h-5 w-40 animate-pulse rounded bg-neutral-200" />
            <div className="h-12 w-full animate-pulse rounded-2xl bg-neutral-200" />
          </div>
        </div>
      </div>
    );
  }

  if (!session || !selectedShape) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 px-4 py-10">
        <p className="text-sm text-[#6B7280]">Nothing to review.</p>
        <Link href="/order" className="text-sm text-[#2563EB] underline">
          Back to order
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-36">
      <div className="mx-auto max-w-lg px-4 pt-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
            Review your magnets
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            This is what will be printed — adjust crops from here if needed.
          </p>
        </header>

        {actionError && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {actionError}
          </p>
        )}

        <ul className="flex flex-col gap-10 pb-4">
          {images.map((img, i) => {
            const low = getIsLowResolution(img, selectedShape);
            return (
            <li
              key={img.id}
              ref={(el) => {
                if (el) reviewItemRefs.current.set(img.id, el);
                else reviewItemRefs.current.delete(img.id);
              }}
              className="flex flex-col gap-3 scroll-mt-4"
            >
              <Link
                href={cropEditHref(img.id)}
                aria-label={`Edit magnet ${i + 1} — adjust crop`}
                className={`group relative mx-auto block w-full max-w-md touch-manipulation overflow-hidden outline-none ring-offset-2 ring-offset-[#FAFAFA] transition active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-[#2563EB] ${previewTapFrameClass}`}
              >
                <CroppedShapePreview image={img} shape={selectedShape} />
                {low && (
                  <span
                    className="pointer-events-none absolute left-2 top-2 z-20 max-w-[calc(100%-1rem)] rounded-md bg-amber-100/95 px-2 py-0.5 text-[11px] font-medium leading-tight text-amber-950 shadow-sm ring-1 ring-amber-200/80 backdrop-blur-[2px]"
                    role="status"
                  >
                    ⚠ Low quality
                  </span>
                )}
                <div
                  className={`pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center bg-gradient-to-t from-black/55 via-black/20 to-transparent px-3 pb-2.5 pt-10 opacity-90 transition-opacity group-hover:opacity-100 group-active:opacity-100 ${
                    previewTapFrameClass === "rounded-full"
                      ? "rounded-b-[999px]"
                      : "rounded-b-xl"
                  }`}
                  aria-hidden
                >
                  <span className="text-xs font-semibold tracking-wide text-white drop-shadow-sm">
                    Tap to edit
                  </span>
                </div>
              </Link>
              {isPerItemPricing && session && (
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    aria-label="Decrease copies for this magnet"
                    disabled={(copiesByImageId[img.id] ?? 1) <= 1}
                    onClick={() => adjustCopies(img.id, -1)}
                    className="flex h-12 min-w-[3rem] shrink-0 items-center justify-center rounded-2xl border-2 border-gray-300 bg-white text-xl font-semibold text-[#111111] disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="min-w-[2.5rem] text-center text-lg font-semibold tabular-nums text-[#111111]">
                    {copiesByImageId[img.id] ?? 1}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase copies for this magnet"
                    disabled={totalMagnets >= magnetCap}
                    onClick={() => adjustCopies(img.id, 1)}
                    className="flex h-12 min-w-[3rem] shrink-0 items-center justify-center rounded-2xl border-2 border-gray-300 bg-white text-xl font-semibold text-[#111111] disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              )}
              <div className="flex gap-3">
                <Link
                  href={cropEditHref(img.id)}
                  className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border-2 border-gray-300 bg-white text-base font-semibold text-[#111111] transition-colors hover:bg-gray-50"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  disabled={deleteId === img.id}
                  onClick={() => void onDelete(img.id)}
                  className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border-2 border-red-200 bg-white text-base font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  {deleteId === img.id ? "…" : "Delete"}
                </button>
              </div>
            </li>
            );
          })}
        </ul>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div
          className="mx-auto flex max-w-lg flex-col gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          {isPerItemPricing ? (
            <div className="text-center text-sm font-medium text-[#111111]">
              <p className="tabular-nums">
                Total magnets: {totalMagnets}
                {session != null && totalMagnets > magnetCap
                  ? ` (max ${magnetCap})`
                  : ""}
              </p>
              <p className="mt-1 tabular-nums">
                Price:{" "}
                {formatMoney(liveTotalPrice, currency)}
              </p>
            </div>
          ) : (
            <p className="text-center text-sm font-medium text-[#111111]">
              {images.length === 0
                ? `0 magnets · ${formatMoney(session?.totalPrice ?? null, currency)}`
                : `${images.length} magnet${images.length === 1 ? "" : "s"} · ${formatMoney(session?.totalPrice ?? null, currency)}`}
            </p>
          )}
          <button
            type="button"
            disabled={!canProceed || committing}
            onClick={() => void onProceed()}
            className="w-full rounded-2xl bg-[#2563EB] py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {committing
              ? isEventSession
                ? "Continuing…"
                : "Placing order…"
              : isEventSession
                ? "Continue to your details"
                : "Proceed to payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
