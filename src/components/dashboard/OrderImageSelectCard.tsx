"use client";

import {
  isCircleOrderShape,
  orderImageThumbSize,
  type OrderImageShape,
} from "@/lib/orderImageThumbSize";
import { RenderedShapeThumbnail } from "@/components/dashboard/RenderedShapeThumbnail";

/** Minimum card width so copies / print status text is never clipped. */
const CARD_MIN_WIDTH_PX = 140;

type Props = {
  renderedUrl: string | null;
  shape: OrderImageShape;
  copies: number;
  printed: boolean;
  selected: boolean;
  removed?: boolean;
  onToggle: () => void;
};

export function OrderImageSelectCard({
  renderedUrl,
  shape,
  copies,
  printed,
  selected,
  removed = false,
  onToggle,
}: Props) {
  const thumb = orderImageThumbSize(shape);
  const cardWidth = Math.max(thumb.width, CARD_MIN_WIDTH_PX);

  if (removed) {
    return (
      <div
        className="flex shrink-0 flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface/50 p-2 opacity-60"
        style={{ width: cardWidth }}
      >
        <div
          className="flex items-center justify-center rounded-lg bg-surface text-xs text-muted-foreground"
          style={{ width: thumb.width, height: thumb.height }}
        >
          Removed
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={selected ? "Deselect image" : "Select image"}
      onClick={onToggle}
      className={`flex shrink-0 flex-col items-center gap-2 rounded-xl border bg-background p-2 text-left transition-shadow ${
        selected
          ? "border-primary ring-2 ring-primary"
          : "border-border hover:bg-surface/50"
      }`}
      style={{ width: cardWidth }}
    >
      <div className="flex w-full justify-center">
        {renderedUrl ? (
          <RenderedShapeThumbnail
            renderedUrl={renderedUrl}
            shape={shape}
            dimmed={printed}
          />
        ) : (
          <div
            className={`flex items-center justify-center bg-surface p-2 text-center text-xs text-muted-foreground ${
              printed ? "opacity-60" : ""
            } ${isCircleOrderShape(shape) ? "rounded-full" : "rounded-lg"}`}
            style={{ width: thumb.width, height: thumb.height }}
          >
            Not rendered
          </div>
        )}
      </div>

      <div className="flex w-full items-start gap-2">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-sm font-semibold ${
            selected
              ? "border-primary bg-primary text-white"
              : "border-border bg-surface text-muted-foreground"
          }`}
          aria-hidden
        >
          {selected ? "✓" : ""}
        </span>
        <div
          className={`min-w-0 flex-1 text-[10px] font-semibold leading-snug ${
            printed ? "text-green-800" : "text-muted-foreground"
          }`}
        >
          <p>Copies: {copies}</p>
          <p>{printed ? "✅ Printed" : "⚪ Not printed"}</p>
        </div>
      </div>
    </button>
  );
}
