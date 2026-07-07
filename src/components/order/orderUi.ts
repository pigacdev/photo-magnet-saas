export const orderBtnPrimary =
  "w-full rounded-xl bg-primary py-4 text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-40";

export const orderBtnSecondary =
  "flex min-h-12 flex-1 items-center justify-center rounded-xl border border-border bg-background text-base font-medium text-foreground transition-colors hover:bg-surface";

export const orderBtnDanger =
  "flex min-h-12 flex-1 items-center justify-center rounded-xl border border-red-200 bg-background text-base font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40";

export const orderCard =
  "rounded-xl border border-border bg-card p-4 shadow-sm";

export const orderAlertError =
  "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200";

export const orderAlertWarning =
  "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-snug text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200";

export const orderLoadingScreen =
  "flex min-h-screen flex-col items-center justify-center bg-surface px-4";

export type OrderContentWidth = "narrow" | "medium" | "wide";

export function orderContentWidthClass(width: OrderContentWidth = "narrow"): string {
  switch (width) {
    case "medium":
      return "mx-auto w-full max-w-lg md:max-w-2xl";
    case "wide":
      return "mx-auto w-full max-w-lg md:max-w-4xl";
    default:
      return "mx-auto w-full max-w-lg";
  }
}
