export const orderBtnPrimary =
  "w-full rounded-xl bg-[#2563EB] py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-40";

export const orderBtnSecondary =
  "flex min-h-12 flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white text-base font-medium text-[#111111] transition-colors hover:bg-gray-50";

export const orderBtnDanger =
  "flex min-h-12 flex-1 items-center justify-center rounded-xl border border-red-200 bg-white text-base font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50";

export const orderCard =
  "rounded-xl border border-gray-200 bg-white p-4 shadow-sm";

export const orderAlertError =
  "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950";

export const orderLoadingScreen =
  "flex min-h-screen flex-col items-center justify-center bg-[var(--surface)] px-4";

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
