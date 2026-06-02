"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import {
  FixedCropCanvas,
  type SessionImageCropPayload,
} from "@/components/order/FixedCropCanvas";
import { OrderShell } from "@/components/order/OrderShell";
import { OrderStepHeader } from "@/components/order/OrderStepHeader";
import { orderBtnPrimary, orderLoadingScreen } from "@/components/order/orderUi";
import { sortMagnetImagesByPosition } from "@/lib/magnetImageSort";
import { readCheckoutImageCopies } from "@/lib/checkoutImageCopiesStorage";
import {
  isBundleMagnetAllocationComplete,
  sumImageCopies,
} from "@/lib/orderMagnetCounts";
import { getSafeOrderReturnTo } from "@/lib/orderReturnTo";
import type {
  CatalogShape,
  GetSessionImagesResponse,
  GetSessionResponse,
  SessionImage,
} from "@/lib/orderSessionTypes";

/** Minimum time the primary button stays on "Saving…" before leaving the screen (trust / double-tap guard). */
const MIN_SAVE_FEEDBACK_MS = 260;

async function ensureMinSaveFeedbackMs(startedAtMs: number): Promise<void> {
  const elapsed = Date.now() - startedAtMs;
  const remaining = MIN_SAVE_FEEDBACK_MS - elapsed;
  if (remaining > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, remaining));
  }
}

/** True if save would be a no-op (same crop + transform). */
function cropPayloadsEqual(
  a: SessionImageCropPayload,
  b: SessionImageCropPayload,
): boolean {
  return (
    a.cropX === b.cropX &&
    a.cropY === b.cropY &&
    a.cropWidth === b.cropWidth &&
    a.cropHeight === b.cropHeight &&
    Math.abs(a.cropScale - b.cropScale) < 1e-5 &&
    Math.abs(a.cropTranslateX - b.cropTranslateX) < 0.01 &&
    Math.abs(a.cropTranslateY - b.cropTranslateY) < 0.01 &&
    Math.abs(a.cropRotation - b.cropRotation) < 1e-5
  );
}

function OrderCropPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const imageIdFromQuery = searchParams.get("imageId");
  const isEditMode = Boolean(imageIdFromQuery);

  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState<SessionImage[]>([]);
  const [shapes, setShapes] = useState<CatalogShape[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [orderBackHref, setOrderBackHref] = useState("/order/photos");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const lastPayloadRef = useRef<SessionImageCropPayload | null>(null);
  /** First stable canvas payload in edit mode — skip redundant PATCH if unchanged at save. */
  const editBaselineRef = useRef<SessionImageCropPayload | null>(null);

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

        if (sessionRes.session.pricingType === "bundle") {
          const sortedForCheck = sortMagnetImagesByPosition(imagesRes.images);
          const stored = readCheckoutImageCopies();
          const byId = new Map(stored.map((r) => [r.imageId, r.copies]));
          const copiesRecord: Record<string, number> = {};
          for (const img of sortedForCheck) {
            const c = byId.get(img.id);
            copiesRecord[img.id] = typeof c === "number" && c >= 1 ? c : 1;
          }
          const total = sumImageCopies(
            sortedForCheck.map((i) => i.id),
            copiesRecord,
          );
          const required = sessionRes.session.maxImagesAllowed;
          if (!isBundleMagnetAllocationComplete(required, total)) {
            router.replace(photosHref);
            return;
          }
        }

        const sorted = sortMagnetImagesByPosition(imagesRes.images);
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

  useEffect(() => {
    if (isEditMode) editBaselineRef.current = null;
  }, [current?.id, isEditMode]);

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
      if (isEditMode && editBaselineRef.current === null) {
        editBaselineRef.current = { ...payload };
      }
      lastPayloadRef.current = payload;
      void persistCrop(current, payload);
    },
    [current, isEditMode, persistCrop],
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
    if (saving) return;
    const saveStartedAt = Date.now();
    setSaving(true);
    setSaveError("");
    try {
      const payload =
        lastPayloadRef.current ?? fallbackPayloadFromRow(current);

      if (isEditMode) {
        const baseline =
          editBaselineRef.current ?? fallbackPayloadFromRow(current);
        const dirty =
          !payload ||
          !baseline ||
          !cropPayloadsEqual(payload, baseline);
        if (dirty && payload) {
          await persistCrop(current, payload);
        }
        await ensureMinSaveFeedbackMs(saveStartedAt);
        const p = new URLSearchParams(q.replace(/^\?/, ""));
        p.set("scrollTo", current.id);
        const reviewQ = p.toString();
        router.push(
          `/order/review${reviewQ ? `?${reviewQ}` : ""}`,
        );
        return;
      }

      if (payload) {
        await persistCrop(current, payload);
      }

      if (index + 1 >= total) {
        await ensureMinSaveFeedbackMs(saveStartedAt);
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

  const primaryLabel = (() => {
    if (saving) return "Saving…";
    if (isEditMode) return "Save editing";
    if (index + 1 < total) return "Next";
    return "Continue";
  })();

  const reviewBackHref = useMemo(() => {
    const p = new URLSearchParams(q.replace(/^\?/, ""));
    p.delete("imageId");
    p.delete("from");
    const s = p.toString();
    return `/order/review${s ? `?${s}` : ""}`;
  }, [q]);

  if (loading) {
    return (
      <div className={orderLoadingScreen}>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!selectedShape || !current) {
    return (
      <OrderShell className="pb-10">
        <div className="flex flex-col gap-6">
          <p className="text-sm text-muted-foreground">Nothing to crop.</p>
          <Link
            href={orderBackHref}
            className="text-center text-sm text-primary underline-offset-4 hover:underline"
          >
            Back to photos
          </Link>
        </div>
      </OrderShell>
    );
  }

  return (
    <OrderShell contentWidth="medium" className="pb-10">
      <div className="flex flex-col gap-6">
        <OrderStepHeader
          title="Adjust your photo for printing"
          subtitle="Move and zoom so the magnet looks right — this is how it will print."
          step={{ current: 3, total: 5, label: `Crop (${index + 1} of ${total})` }}
        />
        <p className="-mt-4 text-center text-sm font-medium text-muted-foreground">
          Image {index + 1} of {total}
        </p>

      {saveError && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {saveError}
        </p>
      )}

      <div className="flex flex-col items-center gap-2">
        <p
          className="w-full max-w-md text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
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
          className={orderBtnPrimary}
        >
          {primaryLabel}
        </button>

        <div className="flex gap-3">
          {index > 0 && !isEditMode && (
            <button
              type="button"
              disabled={saving}
              onClick={goBack}
              className="flex-1 rounded-2xl border-2 border-border bg-background py-3 text-base font-semibold text-foreground transition-colors hover:bg-surface disabled:opacity-50"
            >
              Back
            </button>
          )}
        </div>
      </div>

      {isEditMode && (
        <Link
          href={reviewBackHref}
          className="text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Back to review
        </Link>
      )}

      <Link
        href={orderBackHref}
        className="text-center text-sm text-primary underline-offset-4 hover:underline"
      >
        Back to photos
      </Link>
      </div>
    </OrderShell>
  );
}

export default function OrderCropPage() {
  return (
    <Suspense
      fallback={
        <div className={orderLoadingScreen}>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <OrderCropPageInner />
    </Suspense>
  );
}
