/** Curated magnet-business currencies — keep in sync with server/src/lib/currency.ts */
export const CURRENCY_OPTIONS = [
  { code: "EUR", label: "Euro (EUR)" },
  { code: "USD", label: "US Dollar (USD)" },
  { code: "GBP", label: "British Pound (GBP)" },
  { code: "CHF", label: "Swiss Franc (CHF)" },
  { code: "PLN", label: "Polish Złoty (PLN)" },
  { code: "HRK", label: "Croatian Kuna (HRK)" },
  { code: "BAM", label: "Bosnia-Herz. Mark (BAM)" },
  { code: "RSD", label: "Serbian Dinar (RSD)" },
] as const;

export function getCurrencyLabel(code: string | null | undefined): string {
  if (!code) return "—";
  const normalized = code.trim().toUpperCase();
  return (
    CURRENCY_OPTIONS.find((o) => o.code === normalized)?.label ?? normalized
  );
}

export function formatMoneyAmount(
  amount: number | string,
  currency: string,
  locale = "en-US",
): string {
  const num = typeof amount === "number" ? amount : Number(amount);
  const code = (currency || "EUR").trim().toUpperCase();
  if (!Number.isFinite(num)) return `— ${code}`;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
    }).format(num);
  } catch {
    return `${num} ${code}`;
  }
}
