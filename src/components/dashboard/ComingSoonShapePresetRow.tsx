type ComingSoonShapePresetRowProps = {
  label: string;
};

export function ComingSoonShapePresetRow({ label }: ComingSoonShapePresetRowProps) {
  return (
    <div
      className="flex cursor-not-allowed items-center gap-3 rounded-lg border border-dashed border-border bg-surface/50 px-3 py-2.5 text-sm"
      aria-disabled="true"
    >
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border bg-background opacity-50"
        aria-hidden
      />
      <span className="min-w-0 leading-snug text-muted-foreground">{label}</span>
      <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-violet-600 via-indigo-500 to-fuchsia-500 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
        <svg
          className="size-3 opacity-90"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6l4 2"
          />
          <circle cx="12" cy="12" r="9" />
        </svg>
        Coming soon
      </span>
    </div>
  );
}
