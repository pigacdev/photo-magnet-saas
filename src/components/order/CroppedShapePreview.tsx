"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { catalogShapeAspectRatio } from "@/lib/catalogShapeAspectRatio";
import { drawPostRotationCrop } from "@/lib/renderRotatedCropCanvas";
import type { CatalogShape, SessionImage } from "@/lib/orderSessionTypes";

function isCircleShape(shape: CatalogShape): boolean {
  return shape.shapeType.toUpperCase() === "CIRCLE";
}

type Props = {
  image: SessionImage;
  shape: CatalogShape;
  /** Max CSS width of the preview (height follows shape aspect). */
  maxWidthPx?: number;
};

type LayoutSize = { w: number; h: number };

function drawCropped(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  cw: number,
  ch: number,
  cssW: number,
  cssH: number,
  rotationDeg: number,
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
  drawPostRotationCrop(ctx, img, cx, cy, cw, ch, cssW, cssH, rotationDeg);
}

/**
 * Step 4 review preview — draws the stored pixel crop (same as print/PDF).
 * Resize only scales the preview; crop content is viewport-independent.
 * Do not use pan/zoom UI fields here — those are relative to the crop-editor frame size.
 */
export function CroppedShapePreview({
  image,
  shape,
  maxWidthPx = 384,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadedRef = useRef<{ url: string; img: HTMLImageElement } | null>(null);
  const [layout, setLayout] = useState<LayoutSize>({ w: 0, h: 0 });
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  const cx = image.cropX;
  const cy = image.cropY;
  const cw = image.cropWidth;
  const ch = image.cropHeight;
  const rotation = image.cropRotation ?? 0;

  const frameAspect = catalogShapeAspectRatio(shape);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      setLayout({ w: el.clientWidth, h: el.clientHeight });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
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
      if (cancelled || layout.w < 8 || layout.h < 8) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      drawCropped(canvas, img, cx, cy, cw, ch, layout.w, layout.h, rotation);
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
    rotation,
    layout.w,
    layout.h,
  ]);

  const circle = isCircleShape(shape);

  return (
    <div
      ref={wrapRef}
      className={`relative mx-auto w-full max-w-md overflow-hidden bg-neutral-100 ${
        circle ? "rounded-full" : "rounded-xl"
      }`}
      style={{
        aspectRatio: `${Math.max(0.25, Math.min(4, frameAspect))}`,
      }}
    >
      {status === "loading" && (
        <div
          className="absolute inset-0 z-10 animate-pulse bg-neutral-200"
          aria-hidden
        />
      )}
      {status === "error" && (
        <div className="flex min-h-[200px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
          Preview unavailable
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`absolute left-0 top-0 block ${
          status === "ready" ? "opacity-100" : "opacity-0"
        } transition-opacity duration-150 ${
          circle ? "rounded-full" : "rounded-xl"
        } ${status === "error" ? "hidden" : ""}`}
        aria-hidden={status !== "ready"}
      />
    </div>
  );
}
