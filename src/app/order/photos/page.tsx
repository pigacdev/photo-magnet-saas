"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, apiFormData } from "@/lib/api";
import { ImageCopyStepper } from "@/components/order/ImageCopyStepper";
import { OrderShell } from "@/components/order/OrderShell";
import { OrderStepHeader } from "@/components/order/OrderStepHeader";
import { orderBtnPrimary, orderLoadingScreen } from "@/components/order/orderUi";
import {
  buildCopyRowsFromState,
  buildCopiesRecordFromImageIds,
  persistCopyCountsNow,
  writeCheckoutImageCopies,
} from "@/lib/checkoutImageCopiesStorage";
import { getSafeOrderReturnTo } from "@/lib/orderReturnTo";
import {
  canAddMorePhotos,
  isBundleMagnetAllocationComplete,
  remainingMagnets,
  sumImageCopies,
} from "@/lib/orderMagnetCounts";
import {
  formatBundleAdjustCopiesHint,
  formatBundleMagnetProgress,
  formatBundleMagnetUploadExceeded,
  formatUploadLimitExceededMessage,
  formatUploadLimitHint,
} from "@/lib/orderSessionUploadLimit";
import { getIsLowResolution } from "@/lib/sessionImageLowResolution";
import type {
  GetSessionImagesResponse,
  GetSessionResponse,
  OrderSessionPayload,
  PostSessionImagesResponse,
  SessionImage,
} from "@/lib/orderSessionTypes";

export default function OrderPhotosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orderSession, setOrderSession] = useState<OrderSessionPayload | null>(
    null,
  );
  const [images, setImages] = useState<SessionImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [imagesError, setImagesError] = useState("");
  const [copiesByImageId, setCopiesByImageId] = useState<Record<string, number>>(
    {},
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [orderBackHref, setOrderBackHref] = useState("/order");

  useEffect(() => {
    setOrderBackHref(`/order${window.location.search}`);
  }, []);

  const isBundlePricing = orderSession?.pricingType === "bundle";
  const requiredMagnets = orderSession?.maxImagesAllowed ?? 0;

  const maxUploadImages = useMemo(() => {
    if (!orderSession || orderSession.maxImagesAllowed < 1) return null;
    return orderSession.maxImagesAllowed;
  }, [orderSession]);

  const imageIds = useMemo(() => images.map((i) => i.id), [images]);

  const totalMagnets = useMemo(
    () => sumImageCopies(imageIds, copiesByImageId),
    [imageIds, copiesByImageId],
  );

  const bundleComplete = useMemo(
    () =>
      isBundlePricing &&
      isBundleMagnetAllocationComplete(requiredMagnets, totalMagnets),
    [isBundlePricing, requiredMagnets, totalMagnets],
  );

  const remaining = useMemo(
    () => (isBundlePricing ? remainingMagnets(requiredMagnets, totalMagnets) : 0),
    [isBundlePricing, requiredMagnets, totalMagnets],
  );

  const canAddPhotos = useMemo(() => {
    if (!isBundlePricing) {
      return (
        maxUploadImages != null && images.length < maxUploadImages
      );
    }
    return canAddMorePhotos({
      imagesCount: images.length,
      requiredMagnets,
      totalMagnets,
    });
  }, [isBundlePricing, images.length, requiredMagnets, totalMagnets, maxUploadImages]);

  /** GET /api/session/images → setImages. Use showListLoading on initial / manual refresh only. */
  const fetchSessionImages = useCallback(
    async (opts?: { showListLoading?: boolean }): Promise<boolean> => {
      const showListLoading = opts?.showListLoading !== false;
      if (showListLoading) setImagesLoading(true);
      setImagesError("");
      try {
        const d = await api<GetSessionImagesResponse>("/api/session/images");
        if (d.error === "SESSION_INVALID") {
          const params = new URLSearchParams(window.location.search);
          const fallback = getSafeOrderReturnTo(params.get("returnTo")) ?? "/";
          window.location.replace(fallback);
          return false;
        }
        const fetched = d.images;
        setImages(fetched);
        return true;
      } catch (e) {
        setImagesError(e instanceof Error ? e.message : "Could not load photos");
        setImages([]);
        return false;
      } finally {
        if (showListLoading) setImagesLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fallback = getSafeOrderReturnTo(params.get("returnTo")) ?? "/";
    const orderHref = `/order${params.toString() ? `?${params.toString()}` : ""}`;

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
        if (!sessionRes.session.selectedShapeId) {
          router.replace(orderHref);
          return;
        }
        if (sessionRes.session.maxImagesAllowed < 1) {
          router.replace(orderHref);
          return;
        }
        if (imagesRes.error === "SESSION_INVALID") {
          window.location.replace(fallback);
          return;
        }
        setOrderSession(sessionRes.session);
        const initial = imagesRes.images;
        setImages(initial);
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
    if (!orderSession) return;
    const pricingType = orderSession.pricingType;
    if (pricingType !== "per_item" && pricingType !== "bundle") {
      setCopiesByImageId({});
      return;
    }
    const ids = images.map((i) => i.id);
    setCopiesByImageId(buildCopiesRecordFromImageIds(ids, pricingType));
  }, [images, orderSession]);

  useEffect(() => {
    if (!orderSession) return;
    const pricingType = orderSession.pricingType;
    if (
      (pricingType !== "per_item" && pricingType !== "bundle") ||
      images.length === 0
    ) {
      return;
    }
    writeCheckoutImageCopies(buildCopyRowsFromState(images, copiesByImageId));
  }, [orderSession, images, copiesByImageId]);

  const atPhotoLimit =
    maxUploadImages != null && images.length >= maxUploadImages;

  const hasAnyLowResolution = useMemo(
    () => images.some((img) => getIsLowResolution(img)),
    [images],
  );

  const adjustCopies = useCallback(
    (imageId: string, delta: number) => {
      if (!isBundlePricing) return;
      setCopiesByImageId((prev) => {
        const cur = prev[imageId] ?? 1;
        let n = cur + delta;
        if (n < 1) n = 1;
        const others = images
          .filter((i) => i.id !== imageId)
          .reduce((sum, i) => sum + (prev[i.id] ?? 1), 0);
        if (others + n > requiredMagnets) {
          n = Math.max(1, requiredMagnets - others);
        }
        return { ...prev, [imageId]: n };
      });
    },
    [isBundlePricing, images, requiredMagnets],
  );

  const onPickPhotos = () => {
    if (uploadingPhotos || !canAddPhotos || maxUploadImages == null) return;
    fileInputRef.current?.click();
  };

  const onPhotoFilesSelected = async (files: FileList | null) => {
    if (!files?.length) return;
    if (maxUploadImages == null) return;

    if (isBundlePricing) {
      if (totalMagnets + files.length > requiredMagnets) {
        setImagesError(formatBundleMagnetUploadExceeded(requiredMagnets));
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (images.length + files.length > maxUploadImages) {
        setImagesError(formatUploadLimitExceededMessage(maxUploadImages));
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    } else if (images.length + files.length > maxUploadImages) {
      setImagesError(formatUploadLimitExceededMessage(maxUploadImages));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploadingPhotos(true);
    setImagesError("");
    try {
      const fd = new FormData();
      for (let i = 0; i < files.length; i += 1) {
        fd.append("files", files[i]);
      }
      const postRes = await apiFormData<PostSessionImagesResponse>(
        "/api/session/images",
        fd,
      );
      if (postRes.errors?.length) {
        setImagesError(
          postRes.errors.map((e) => `${e.filename}: ${e.error}`).join(" · "),
        );
      }

      const d = await api<GetSessionImagesResponse>("/api/session/images");
      if (d.error === "SESSION_INVALID") {
        const params = new URLSearchParams(window.location.search);
        const fallback = getSafeOrderReturnTo(params.get("returnTo")) ?? "/";
        window.location.replace(fallback);
        return;
      }
      const fetchedImages = d.images;
      setImages(fetchedImages);
    } catch (e) {
      setImagesError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingPhotos(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteSessionImage = async (id: string) => {
    if (uploadingPhotos) return;
    setImagesError("");
    try {
      await api<{ success: boolean }>(`/api/session/images/${id}`, {
        method: "DELETE",
      });
      setCopiesByImageId((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await fetchSessionImages({ showListLoading: true });
    } catch (e) {
      setImagesError(e instanceof Error ? e.message : "Could not remove photo");
    }
  };

  const continueToCrop = () => {
    if (isBundlePricing && !bundleComplete) return;
    if (!isBundlePricing && images.length === 0) return;
    if (orderSession?.pricingType) {
      persistCopyCountsNow(images, copiesByImageId, orderSession.pricingType);
    }
    const q =
      typeof window !== "undefined" ? window.location.search : "";
    router.push(`/order/crop${q}`);
  };

  const addPhotosLabel = useMemo(() => {
    if (uploadingPhotos) return "Uploading…";
    if (isBundlePricing) {
      if (!canAddPhotos) return null;
      return remaining === 1 ? "Add Photos (1)" : `Add Photos (${remaining})`;
    }
    if (atPhotoLimit) return "Maximum reached";
    return "Add Photos";
  }, [uploadingPhotos, isBundlePricing, canAddPhotos, remaining, atPhotoLimit]);

  if (loading) {
    return (
      <div className={orderLoadingScreen}>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <OrderShell contentWidth="medium" className="pb-10">
      <div className="flex flex-col gap-6" aria-busy={uploadingPhotos || imagesLoading}>
        <OrderStepHeader
          title="Add photos"
          subtitle="Choose photos for your magnets"
          step={{ current: 2, total: 5, label: "Upload" }}
        />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
        multiple
        className="sr-only"
        aria-hidden
        onChange={(e) => void onPhotoFilesSelected(e.target.files)}
      />

      {imagesLoading && (
        <p className="text-center text-sm text-muted-foreground">Loading photos…</p>
      )}

      {hasAnyLowResolution && images.length > 0 && (
        <p
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-snug text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          role="status"
        >
          Some images may print blurry. You can continue or replace them.
        </p>
      )}

      {images.length > 0 && (
        <div
          className="image-list flex flex-col gap-3"
          role="list"
          aria-label="Uploaded photos"
        >
          {images.map((img) => {
            const low = getIsLowResolution(img);
            const copies = copiesByImageId[img.id] ?? 1;
            const othersSum = totalMagnets - copies;
            const maxCopiesForImage = isBundlePricing
              ? Math.max(1, requiredMagnets - othersSum)
              : 1;
            return (
              <div key={img.id} className="image-item flex flex-col gap-1.5">
                <div
                  className="relative w-full overflow-hidden rounded-[12px] border border-gray-200 bg-gray-100"
                  data-low-resolution={low ? "true" : "false"}
                  role="listitem"
                >
                  {low && (
                    <span className="absolute left-2 top-2 z-10 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-950 shadow-sm">
                      Low quality
                    </span>
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.originalUrl}
                    alt=""
                    className="block h-auto w-full max-h-[200px] object-cover"
                  />
                  <button
                    type="button"
                    disabled={uploadingPhotos}
                    onClick={() => void deleteSessionImage(img.id)}
                    className="delete absolute right-2 top-2 z-10 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/60 text-xl font-bold leading-none text-white shadow-md transition-colors hover:bg-black/75 active:bg-black/80 disabled:opacity-50"
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
                <p className="px-0.5 text-xs text-muted-foreground">
                  {img.width} × {img.height} px
                  {low ? " • Low quality" : ""}
                </p>
                {isBundlePricing && (
                  <ImageCopyStepper
                    copies={copies}
                    maxCopies={maxCopiesForImage}
                    disabled={uploadingPhotos}
                    onAdjust={(delta) => adjustCopies(img.id, delta)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {imagesError && (
          <div
            className="relative rounded-lg border border-red-200 bg-red-50 py-3 pl-4 pr-11 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
            role="alert"
          >
            {imagesError}
            <button
              type="button"
              onClick={() => setImagesError("")}
              className="absolute right-2 top-2 flex min-h-8 min-w-8 items-center justify-center rounded-md text-red-700 transition-colors hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/50"
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        {isBundlePricing && !bundleComplete && !canAddPhotos && images.length > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            {formatBundleAdjustCopiesHint()}
          </p>
        )}

        {isBundlePricing && bundleComplete ? (
          <button
            type="button"
            disabled={uploadingPhotos}
            onClick={continueToCrop}
            className={orderBtnPrimary}
          >
            Continue to crop
          </button>
        ) : addPhotosLabel != null ? (
          <button
            type="button"
            disabled={
              uploadingPhotos ||
              !canAddPhotos ||
              maxUploadImages == null ||
              (!isBundlePricing && atPhotoLimit)
            }
            onClick={onPickPhotos}
            className="w-full rounded-2xl border-2 border-primary bg-primary py-4 text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {addPhotosLabel}
          </button>
        ) : null}

        {!isBundlePricing && (
          <button
            type="button"
            disabled={images.length === 0 || uploadingPhotos}
            onClick={continueToCrop}
            className={orderBtnPrimary}
          >
            Continue to crop
          </button>
        )}

        {maxUploadImages != null && (
          <p className="text-center text-sm text-muted-foreground">
            JPG, PNG, or HEIC — up to 10&nbsp;MB each.{" "}
            {isBundlePricing
              ? formatBundleMagnetProgress(totalMagnets, requiredMagnets)
              : `${formatUploadLimitHint(maxUploadImages)} for this order.`}
          </p>
        )}

        {!isBundlePricing && atPhotoLimit && maxUploadImages != null && (
          <p className="text-center text-sm text-muted-foreground">
            Maximum reached ({maxUploadImages} photo
            {maxUploadImages === 1 ? "" : "s"} for this order).
          </p>
        )}
      </div>

      <Link
        href={orderBackHref}
        className="text-center text-sm text-primary underline-offset-4 hover:underline"
      >
        Back to shape &amp; price
      </Link>
      </div>
    </OrderShell>
  );
}
