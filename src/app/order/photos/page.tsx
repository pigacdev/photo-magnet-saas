"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, apiFormData } from "@/lib/api";
import { getSafeOrderReturnTo } from "@/lib/orderReturnTo";
import {
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [orderBackHref, setOrderBackHref] = useState("/order");

  useEffect(() => {
    setOrderBackHref(`/order${window.location.search}`);
  }, []);

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

  const maxUploadImages = useMemo(() => {
    if (!orderSession || orderSession.maxImagesAllowed < 1) return null;
    return orderSession.maxImagesAllowed;
  }, [orderSession]);

  const atPhotoLimit =
    maxUploadImages != null && images.length >= maxUploadImages;

  const hasAnyLowResolution = useMemo(
    () => images.some((img) => getIsLowResolution(img)),
    [images],
  );

  const onPickPhotos = () => {
    if (uploadingPhotos || atPhotoLimit || maxUploadImages == null) return;
    fileInputRef.current?.click();
  };

  const onPhotoFilesSelected = async (files: FileList | null) => {
    if (!files?.length) return;
    if (maxUploadImages == null) return;
    if (images.length + files.length > maxUploadImages) {
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
      await fetchSessionImages({ showListLoading: true });
    } catch (e) {
      setImagesError(e instanceof Error ? e.message : "Could not remove photo");
    }
  };

  const continueToCrop = () => {
    if (images.length === 0) return;
    const q =
      typeof window !== "undefined" ? window.location.search : "";
    router.push(`/order/crop${q}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] px-4">
        <p className="text-sm text-[#6B7280]">Loading…</p>
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 bg-[#FAFAFA] px-4 pb-10 pt-8"
      aria-busy={uploadingPhotos || imagesLoading}
    >
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
          Add Photos
        </h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Choose photos for your magnets
        </p>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
        multiple
        className="sr-only"
        aria-hidden
        onChange={(e) => void onPhotoFilesSelected(e.target.files)}
      />

      <button
        type="button"
        disabled={uploadingPhotos || atPhotoLimit || maxUploadImages == null}
        onClick={onPickPhotos}
        className="w-full rounded-2xl border-2 border-[#2563EB] bg-[#2563EB] py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {uploadingPhotos
          ? "Uploading…"
          : atPhotoLimit
            ? "Maximum reached"
            : "Add Photos"}
      </button>

      {maxUploadImages != null && (
        <p className="text-center text-sm text-[#6B7280]">
          JPG, PNG, or HEIC — up to 10&nbsp;MB each.{" "}
          {formatUploadLimitHint(maxUploadImages)} for this order.
        </p>
      )}

      {atPhotoLimit && maxUploadImages != null && (
        <p className="text-center text-sm text-[#6B7280]">
          Maximum reached ({maxUploadImages} photo
          {maxUploadImages === 1 ? "" : "s"} for this order).
        </p>
      )}

      {imagesError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {imagesError}
        </p>
      )}

      {imagesLoading && (
        <p className="text-center text-sm text-[#6B7280]">Loading photos…</p>
      )}

      {hasAnyLowResolution && images.length > 0 && (
        <p
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-snug text-amber-950"
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
                <p className="px-0.5 text-xs text-[#6B7280]">
                  {img.width} × {img.height} px
                  {low ? " • Low quality" : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        disabled={images.length === 0 || uploadingPhotos}
        onClick={continueToCrop}
        className="w-full rounded-2xl bg-[#2563EB] py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Continue to Crop
      </button>

      <Link
        href={orderBackHref}
        className="text-center text-sm text-[#2563EB] underline-offset-4 hover:underline"
      >
        Back to shape &amp; price
      </Link>
    </div>
  );
}
