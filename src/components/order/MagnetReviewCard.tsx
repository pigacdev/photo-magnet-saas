"use client";

import Link from "next/link";
import { CroppedShapePreview } from "./CroppedShapePreview";
import { orderBtnDanger, orderBtnSecondary } from "./orderUi";
import type { CatalogShape, SessionImage } from "@/lib/orderSessionTypes";

export type MagnetReviewCardProps = {
  image: SessionImage;
  shape: CatalogShape;
  index: number;
  cropEditHref: string;
  onCropLinkClick?: () => void;
  isLowResolution: boolean;
  isPerItemPricing: boolean;
  copies: number;
  magnetCap: number;
  totalMagnets: number;
  onAdjustCopies: (delta: number) => void;
  onDelete: () => void;
  deleting: boolean;
  previewFrameClass: string;
};

function PencilIcon() {
  return (
    <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L4 13.172V16h2.828l7.379-7.379-2.828-2.828z" />
    </svg>
  );
}

export function MagnetReviewCard({
  image,
  shape,
  index,
  cropEditHref,
  onCropLinkClick,
  isLowResolution,
  isPerItemPricing,
  copies,
  magnetCap,
  totalMagnets,
  onAdjustCopies,
  onDelete,
  deleting,
  previewFrameClass,
}: MagnetReviewCardProps) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          Magnet {index + 1}
        </h2>
        {isLowResolution && (
          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-950 ring-1 ring-amber-200">
            Low quality
          </span>
        )}
      </div>

      <Link
        href={cropEditHref}
        onClick={onCropLinkClick}
        aria-label={`Edit magnet ${index + 1} — adjust crop`}
        className={`group relative mx-auto block w-full max-w-md touch-manipulation overflow-hidden outline-none transition active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${previewFrameClass}`}
      >
        <CroppedShapePreview image={image} shape={shape} />
        <span className="pointer-events-none absolute right-2 top-2 flex size-9 items-center justify-center rounded-full bg-background/95 text-muted-foreground shadow-md ring-1 ring-black/5 transition group-hover:bg-background group-hover:text-primary">
          <PencilIcon />
        </span>
      </Link>

      {isPerItemPricing && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            aria-label="Decrease copies for this magnet"
            disabled={copies <= 1}
            onClick={() => onAdjustCopies(-1)}
            className="flex h-11 min-w-[2.75rem] shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-lg font-semibold text-foreground disabled:opacity-40"
          >
            −
          </button>
          <span className="min-w-[2.5rem] text-center text-lg font-semibold tabular-nums text-foreground">
            {copies}
          </span>
          <button
            type="button"
            aria-label="Increase copies for this magnet"
            disabled={totalMagnets >= magnetCap}
            onClick={() => onAdjustCopies(1)}
            className="flex h-11 min-w-[2.75rem] shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-lg font-semibold text-foreground disabled:opacity-40"
          >
            +
          </button>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Link
          href={cropEditHref}
          onClick={onCropLinkClick}
          className={orderBtnSecondary}
        >
          Edit crop
        </Link>
        <button
          type="button"
          disabled={deleting}
          onClick={onDelete}
          className={orderBtnDanger}
        >
          {deleting ? "…" : "Remove"}
        </button>
      </div>
    </article>
  );
}
