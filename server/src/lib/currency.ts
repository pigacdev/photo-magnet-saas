/** Curated magnet-business currencies (ISO 4217 alpha-3). Not the full ISO catalog. */
export const SUPPORTED_CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "PLN",
  "HRK",
  "BAM",
  "RSD",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

const SUPPORTED_SET = new Set<string>(SUPPORTED_CURRENCIES);

const ISO4217_ALPHA3 = /^[A-Z]{3}$/;

export type CurrencyOption = {
  code: SupportedCurrency;
  label: string;
};

/** Human-readable labels for onboarding and account settings. */
export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: "EUR", label: "Euro (EUR)" },
  { code: "USD", label: "US Dollar (USD)" },
  { code: "GBP", label: "British Pound (GBP)" },
  { code: "CHF", label: "Swiss Franc (CHF)" },
  { code: "PLN", label: "Polish Złoty (PLN)" },
  { code: "HRK", label: "Croatian Kuna (HRK)" },
  { code: "BAM", label: "Bosnia-Herz. Mark (BAM)" },
  { code: "RSD", label: "Serbian Dinar (RSD)" },
];

export function isSupportedCurrency(code: string): code is SupportedCurrency {
  const normalized = code.trim().toUpperCase();
  return ISO4217_ALPHA3.test(normalized) && SUPPORTED_SET.has(normalized);
}

export function normalizeCurrencyCode(code: string): SupportedCurrency | null {
  const normalized = code.trim().toUpperCase();
  return isSupportedCurrency(normalized) ? normalized : null;
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
