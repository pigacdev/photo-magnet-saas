"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { catalogShapeAspectRatio } from "@/lib/catalogShapeAspectRatio";
import type { CatalogShape, SessionImage } from "@/lib/orderSessionTypes";

function isCircleShape(shape: CatalogShape): boolean {
  return shape.shapeType.toUpperCase() === "CIRCLE";
}

type Props = {
  image: SessionImage;
  shape: CatalogShape;
  /** Max CSS width of the preview (height follows shape aspect, not crop pixels). */
  maxWidthPx?: number;
};

function drawCropped(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  cw: number,
  ch: number,
  cssW: number,
  cssH: number,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.max(1, Math.round(cssW * dpr));
  canvas.height = Math.max(1, Math.round(cssH * dpr));

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, cx, cy, cw, ch, 0, 0, cssW, cssH);
}

/**
 * Draws the stored crop into a frame that matches the magnet shape (not crop pixel ratio),
 * so the preview stays a true circle / correct rectangle even if crop data drifts slightly.
 */
export function CroppedShapePreview({
  image,
  shape,
  maxWidthPx = 384,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadedRef = useRef<{ url: string; img: HTMLImageElement } | null>(null);
  const [layoutW, setLayoutW] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  const cx = image.cropX;
  const cy = image.cropY;
  const cw = image.cropWidth;
  const ch = image.cropHeight;

  const frameAspect = catalogShapeAspectRatio(shape);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setLayoutW(el.clientWidth));
    ro.observe(el);
    setLayoutW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (
      cx == null ||
      cy == null ||
      cw == null ||
      ch == null ||
      cw < 1 ||
      ch < 1
    ) {
      setStatus("error");
      return;
    }

    let cancelled = false;

    const paint = (img: HTMLImageElement) => {
      if (cancelled || layoutW < 8) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const cssW = Math.min(maxWidthPx, layoutW);
      const cssH = cssW / frameAspect;
      drawCropped(canvas, img, cx, cy, cw, ch, cssW, cssH);
      setStatus("ready");
    };

    const cached = loadedRef.current;
    if (
      cached &&
      cached.url === image.originalUrl &&
      cached.img.complete
    ) {
      paint(cached.img);
      return () => {
        cancelled = true;
      };
    }

    const img = new Image();
    img.decoding = "async";
    /**
     * Canvas + cross-origin pixels:
     * - Same-origin URLs (e.g. `/uploads/...` on the app host): do not set `crossOrigin`
     *   (same-origin loads are fine for `drawImage` without tainting).
     * - Absolute `http(s):` URLs (e.g. public S3): set `anonymous` so the bitmap is
     *   CORS-enabled; otherwise the canvas can be tainted or the load may fail.
     * Production: object storage must send `Access-Control-Allow-Origin` for this app
     * (or `*` for public GET). See docs/DEV-WORKFLOW.md (session image URLs & canvas).
     */
    if (/^https?:\/\//i.test(image.originalUrl)) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      if (cancelled) return;
      loadedRef.current = { url: image.originalUrl, img };
      paint(img);
    };
    img.onerror = () => {
      if (!cancelled) setStatus("error");
    };
    img.src = image.originalUrl;

    return () => {
      cancelled = true;
    };
  }, [
    image.originalUrl,
    cx,
    cy,
    cw,
    ch,
    maxWidthPx,
    layoutW,
    frameAspect,
  ]);

  const circle = isCircleShape(shape);

  return (
    <div
      ref={wrapRef}
      className={`relative w-full overflow-hidden bg-neutral-100 ${
        circle ? "aspect-square max-w-[min(100%,384px)] rounded-full" : "rounded-xl"
      }`}
      style={
        circle
          ? undefined
          : {
              aspectRatio: `${Math.max(0.25, Math.min(4, frameAspect))}`,
            }
      }
    >
      {status === "loading" && (
        <div
          className="absolute inset-0 z-10 animate-pulse bg-neutral-200"
          aria-hidden
        />
      )}
      {status === "error" && (
        <div className="flex min-h-[200px] items-center justify-center px-4 text-center text-sm text-[#6B7280]">
          Preview unavailable
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`mx-auto block max-w-full ${
          status === "ready" ? "opacity-100" : "opacity-0"
        } transition-opacity duration-150 ${
          circle ? "rounded-full" : "rounded-xl"
        } ${status === "error" ? "hidden" : ""}`}
        aria-hidden={status !== "ready"}
      />
    </div>
  );
}
