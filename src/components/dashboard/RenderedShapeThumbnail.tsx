"use client";

import {
  isCircleOrderShape,
  orderImageThumbSize,
  type OrderImageShape,
} from "@/lib/orderImageThumbSize";

type Props = {
  renderedUrl: string;
  shape: OrderImageShape;
  dimmed?: boolean;
  maxPx?: number;
};

export function RenderedShapeThumbnail({
  renderedUrl,
  shape,
  dimmed = false,
  maxPx = 132,
}: Props) {
  const { width, height } = orderImageThumbSize(shape, maxPx);
  const circle = isCircleOrderShape(shape);

  return (
    <div
      className={`overflow-hidden bg-surface ${
        circle ? "rounded-full" : "rounded-lg"
      } ${dimmed ? "opacity-60" : ""}`}
      style={{ width, height }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={renderedUrl}
        alt=""
        className="h-full w-full object-cover"
      />
    </div>
  );
}
