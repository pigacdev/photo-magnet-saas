"use client";

export type ImageCopyStepperProps = {
  copies: number;
  minCopies?: number;
  maxCopies: number;
  disabled?: boolean;
  onAdjust: (delta: number) => void;
  label?: string;
};

export function ImageCopyStepper({
  copies,
  minCopies = 1,
  maxCopies,
  disabled = false,
  onAdjust,
  label = "Copies",
}: ImageCopyStepperProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-0.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Decrease copies"
          disabled={disabled || copies <= minCopies}
          onClick={() => onAdjust(-1)}
          className="flex h-9 min-w-[2.25rem] shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-base font-semibold text-foreground disabled:opacity-40"
        >
          −
        </button>
        <span className="min-w-[2rem] text-center text-base font-semibold tabular-nums text-foreground">
          {copies}
        </span>
        <button
          type="button"
          aria-label="Increase copies"
          disabled={disabled || copies >= maxCopies}
          onClick={() => onAdjust(1)}
          className="flex h-9 min-w-[2.25rem] shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-base font-semibold text-foreground disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}
