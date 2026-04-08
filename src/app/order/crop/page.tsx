"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  FixedCropCanvas,
  type SessionImageCropPayload,
} from "@/components/order/FixedCropCanvas";
import { getSafeOrderReturnTo } from "@/lib/orderReturnTo";
import type {
  CatalogShape,
  GetSessionImagesResponse,
  GetSessionResponse,
  SessionImage,
} from "@/lib/orderSessionTypes";

export default function OrderCropPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState<SessionImage[]>([]);
  const [shapes, setShapes] = useState<CatalogShape[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [orderBackHref, setOrderBackHref] = useState("/order/photos");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const lastPayloadRef = useRef<SessionImageCropPayload | null>(null);

  useEffect(() => {
    setOrderBackHref(`/order/photos${window.location.search}`);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fallback = getSafeOrderReturnTo(params.get("returnTo")) ?? "/";
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
          router.replace(`/order${params.toString() ? `?${params.toString()}` : ""}`);
          return;
        }
        if (imagesRes.images.length === 0) {
          router.replace(photosHref);
          return;
        }

        const sorted = [...imagesRes.images].sort((a, b) => a.position - b.position);
        setImages(sorted);
        setShapes(sessionRes.shapes);
        setSelectedShapeId(sessionRes.session.selectedShapeId);

        const imageId = params.get("imageId");
        if (imageId) {
          const idx = sorted.findIndex((i) => i.id === imageId);
          if (idx >= 0) setIndex(idx);
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

  const selectedShape = useMemo(() => {
    if (!selectedShapeId) return null;
    return shapes.find((s) => s.id === selectedShapeId) ?? null;
  }, [shapes, selectedShapeId]);

  const current = images[index] ?? null;
  const total = images.length;
  const q =
    typeof window !== "undefined" ? window.location.search : "";

  const persistCrop = useCallback(
    async (img: SessionImage, payload: SessionImageCropPayload) => {
      setSaveError("");
      const res = await api<{ image: SessionImage }>(
        `/api/session/images/${img.id}`,
        {
          method: "PATCH",
          body: {
            cropX: payload.cropX,
            cropY: payload.cropY,
            cropWidth: payload.cropWidth,
            cropHeight: payload.cropHeight,
            cropScale: payload.cropScale,
            cropTranslateX: payload.cropTranslateX,
            cropTranslateY: payload.cropTranslateY,
            cropRotation: payload.cropRotation,
          },
        },
      );
      setImages((prev) =>
        prev.map((row) => (row.id === res.image.id ? res.image : row)),
      );
    },
    [],
  );

  const onCropChange = useCallback(
    (payload: SessionImageCropPayload) => {
      if (!current) return;
      lastPayloadRef.current = payload;
      void persistCrop(current, payload);
    },
    [current, persistCrop],
  );

  function fallbackPayloadFromRow(img: SessionImage): SessionImageCropPayload | null {
    if (
      img.cropWidth == null ||
      img.cropHeight == null ||
      img.cropX == null ||
      img.cropY == null
    ) {
      return null;
    }
    return {
      cropX: img.cropX,
      cropY: img.cropY,
      cropWidth: img.cropWidth,
      cropHeight: img.cropHeight,
      cropScale: img.cropScale ?? 1,
      cropTranslateX: img.cropTranslateX ?? 0,
      cropTranslateY: img.cropTranslateY ?? 0,
      cropRotation: img.cropRotation ?? 0,
    };
  }

  const goNext = async () => {
    if (!current || !selectedShape) return;
    setSaving(true);
    setSaveError("");
    try {
      const payload =
        lastPayloadRef.current ?? fallbackPayloadFromRow(current);
      if (payload) {
        await persistCrop(current, payload);
      }
      if (index + 1 >= total) {
        router.push(`/order/review${q}`);
        return;
      }
      lastPayloadRef.current = null;
      setIndex((i) => i + 1);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    if (index <= 0) return;
    lastPayloadRef.current = null;
    setIndex((i) => i - 1);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] px-4">
        <p className="text-sm text-[#6B7280]">Loading…</p>
      </div>
    );
  }

  if (!selectedShape || !current) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 bg-[#FAFAFA] px-4 pb-10 pt-8">
        <p className="text-sm text-[#6B7280]">Nothing to crop.</p>
        <Link
          href={orderBackHref}
          className="text-center text-sm text-[#2563EB] underline-offset-4 hover:underline"
        >
          Back to photos
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 bg-[#FAFAFA] px-4 pb-10 pt-8">
      <header>
        <p className="text-center text-sm font-medium text-[#6B7280]">
          Image {index + 1} of {total}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#111111]">
          Adjust your photo for printing
        </h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Move and zoom so the magnet looks right — this is how it will print.
        </p>
      </header>

      {saveError && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {saveError}
        </p>
      )}

      <div className="flex flex-col items-center gap-2">
        <p
          className="w-full max-w-md text-center text-xs font-medium uppercase tracking-wide text-[#6B7280]"
          aria-live="polite"
        >
          Live preview
        </p>
        <FixedCropCanvas
          key={current.id}
          image={current}
          shape={selectedShape}
          onChange={onCropChange}
        />
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void goNext()}
          className="w-full rounded-2xl bg-[#2563EB] py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
        >
          {saving ? "Saving…" : index + 1 < total ? "Next" : "Continue"}
        </button>

        <div className="flex gap-3">
          {index > 0 && (
            <button
              type="button"
              disabled={saving}
              onClick={goBack}
              className="flex-1 rounded-2xl border-2 border-gray-300 bg-white py-3 text-base font-semibold text-[#111111] transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Back
            </button>
          )}
        </div>
      </div>

      <Link
        href={orderBackHref}
        className="text-center text-sm text-[#2563EB] underline-offset-4 hover:underline"
      >
        Back to photos
      </Link>
    </div>
  );
}
