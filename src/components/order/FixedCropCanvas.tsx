"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { catalogShapeAspectRatio } from "@/lib/catalogShapeAspectRatio";
import { normalizeRotation } from "@/lib/cropRotation";
import {
  MAX_CROP_ZOOM_FACTOR,
  clampPan,
  computeCropPixelRect,
  effectiveScale,
  minCoverScale,
} from "@/lib/fixedFrameCropMath";
import type { CatalogShape, SessionImage } from "@/lib/orderSessionTypes";

export type SessionImageCropPayload = {
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  cropScale: number;
  cropTranslateX: number;
  cropTranslateY: number;
  cropRotation: number;
};

type Props = {
  image: SessionImage;
  shape: CatalogShape;
  onChange: (payload: SessionImageCropPayload) => void;
};

function isCircleShape(shape: CatalogShape): boolean {
  return shape.shapeType.toUpperCase() === "CIRCLE";
}

function buildPayload(
  ow: number,
  oh: number,
  fw: number,
  fh: number,
  tx: number,
  ty: number,
  k: number,
  userZoom: number,
  rotationDeg: number,
): SessionImageCropPayload {
  const pc = clampPan(ow, oh, fw, fh, k, tx, ty, rotationDeg);
  const rect = computeCropPixelRect(
    ow,
    oh,
    fw,
    fh,
    pc.tx,
    pc.ty,
    k,
    rotationDeg,
  );
  return {
    ...rect,
    cropScale: userZoom,
    cropTranslateX: pc.tx,
    cropTranslateY: pc.ty,
    cropRotation: rotationDeg,
  };
}

export function FixedCropCanvas({ image, shape, onChange }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Ensures parent gets at least one payload before the debounced timer (e.g. fast Next tap). */
  const initialEmitDoneRef = useRef(false);

  const [fw, setFw] = useState(0);
  const [fh, setFh] = useState(0);

  const ow = image.width;
  const oh = image.height;

  const [rotation, setRotation] = useState(() =>
    normalizeRotation(image.cropRotation ?? 0),
  );
  const [pan, setPan] = useState(() => ({
    tx: image.cropTranslateX ?? 0,
    ty: image.cropTranslateY ?? 0,
  }));
  const [userZoom, setUserZoom] = useState(() =>
    typeof image.cropScale === "number" && image.cropScale >= 1
      ? image.cropScale
      : 1,
  );

  const dragRef = useRef<{
    sx: number;
    sy: number;
    tx: number;
    ty: number;
  } | null>(null);

  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setFw(r.width);
      setFh(r.height);
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setFw(r.width);
    setFh(r.height);
    return () => ro.disconnect();
  }, []);

  const baseK =
    fw > 0 && fh > 0 ? minCoverScale(fw, fh, ow, oh, rotation) : 1;
  const k = effectiveScale(baseK, userZoom);

  useEffect(() => {
    if (fw <= 0 || fh <= 0) return;
    setPan((p) => clampPan(ow, oh, fw, fh, k, p.tx, p.ty, rotation));
  }, [ow, oh, fw, fh, k, rotation]);

  const panClamped = clampPan(ow, oh, fw, fh, k, pan.tx, pan.ty, rotation);

  useLayoutEffect(() => {
    if (fw <= 0 || fh <= 0) return;
    if (initialEmitDoneRef.current) return;
    onChangeRef.current(
      buildPayload(ow, oh, fw, fh, pan.tx, pan.ty, k, userZoom, rotation),
    );
    initialEmitDoneRef.current = true;
  }, [ow, oh, fw, fh, k, pan.tx, pan.ty, userZoom, rotation]);

  useEffect(() => {
    if (fw <= 0 || fh <= 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChangeRef.current(
        buildPayload(ow, oh, fw, fh, pan.tx, pan.ty, k, userZoom, rotation),
      );
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [ow, oh, fw, fh, k, pan.tx, pan.ty, userZoom, rotation]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragRef.current = {
      sx: e.clientX,
      sy: e.clientY,
      tx: panClamped.tx,
      ty: panClamped.ty,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;
    setPan(
      clampPan(
        ow,
        oh,
        fw,
        fh,
        k,
        dragRef.current.tx + dx,
        dragRef.current.ty + dy,
        rotation,
      ),
    );
  };

  const endPointer = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setUserZoom((z) => {
      const nz = Math.min(
        MAX_CROP_ZOOM_FACTOR,
        Math.max(1, z * (1 + delta)),
      );
      return Number.isFinite(nz) ? nz : z;
    });
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchRef.current = { startDist: dist, startZoom: userZoom };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 2 || !pinchRef.current) return;
    e.preventDefault();
    const [a, b] = [e.touches[0], e.touches[1]];
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const ratio = dist / pinchRef.current.startDist;
    const nz = Math.min(
      MAX_CROP_ZOOM_FACTOR,
      Math.max(1, pinchRef.current.startZoom * ratio),
    );
    setUserZoom(nz);
  };

  const onTouchEnd = () => {
    pinchRef.current = null;
  };

  const imgLeft = fw / 2 + panClamped.tx - (ow * k) / 2;
  const imgTop = fh / 2 + panClamped.ty - (oh * k) / 2;
  const imgCenterX = imgLeft + (ow * k) / 2;
  const imgCenterY = imgTop + (oh * k) / 2;

  const ar = catalogShapeAspectRatio(shape);
  const circle = isCircleShape(shape);

  const zoomOut = useCallback(() => {
    setUserZoom((z) => Math.max(1, z / 1.08));
  }, []);

  const zoomIn = useCallback(() => {
    setUserZoom((z) => Math.min(MAX_CROP_ZOOM_FACTOR, z * 1.08));
  }, []);

  const rotate90 = useCallback(() => {
    setRotation((r) => normalizeRotation(r + 90));
    setPan({ tx: 0, ty: 0 });
    setUserZoom(1);
  }, []);

  return (
    <div className="w-full">
      <div
        ref={frameRef}
        className={`relative mx-auto w-full max-w-md touch-none select-none overflow-hidden bg-neutral-900 ${
          circle ? "rounded-full" : "rounded-xl"
        }`}
        style={{ aspectRatio: `${ar}` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.originalUrl}
          alt=""
          width={ow}
          height={oh}
          draggable={false}
          className="pointer-events-none absolute block max-w-none"
          style={{
            width: ow * k,
            height: oh * k,
            left: imgLeft,
            top: imgTop,
            transform: `rotate(${rotation}deg)`,
            transformOrigin: `${imgCenterX - imgLeft}px ${imgCenterY - imgTop}px`,
          }}
        />
        {circle && (
          <div
            className="pointer-events-none absolute inset-0 z-10 rounded-full shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.45)]"
            aria-hidden
          />
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          type="button"
          className="min-h-12 min-w-12 rounded-2xl border-2 border-border bg-background text-lg font-semibold text-foreground active:bg-surface"
          aria-label="Zoom out"
          onClick={zoomOut}
        >
          −
        </button>
        <button
          type="button"
          className="min-h-12 min-w-12 rounded-2xl border-2 border-border bg-background text-lg font-semibold text-foreground active:bg-surface"
          aria-label="Rotate 90 degrees"
          onClick={rotate90}
        >
          <svg
            className="mx-auto size-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
        </button>
        <button
          type="button"
          className="min-h-12 min-w-12 rounded-2xl border-2 border-border bg-background text-lg font-semibold text-foreground active:bg-surface"
          aria-label="Zoom in"
          onClick={zoomIn}
        >
          +
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Drag to move · Pinch or scroll to zoom · Tap rotate to turn
      </p>
    </div>
  );
}
