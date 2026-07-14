/** Server-side legal constants — keep in sync with src/lib/legalConstants.ts */

export const CURRENT_POLICY_VERSION = "2026-07-14";

export const LEGAL_ENTITY = {
  name: "Magnetoo",
  contactEmail: "magnetooprints@gmail.com",
  address: "Croatia, European Union",
  privacyUrl: "/privacy",
} as const;

function readNonNegativeIntEnv(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return defaultValue;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return defaultValue;
  return n;
}

export const ACCOUNT_ERASURE_GRACE_DAYS = readNonNegativeIntEnv(
  "ACCOUNT_ERASURE_GRACE_DAYS",
  30,
);

export const ORDER_PII_RETENTION_DAYS = readNonNegativeIntEnv(
  "ORDER_PII_RETENTION_DAYS",
  365,
);

export function needsLegalReconsent(
  legalAcceptedAt: Date | null | undefined,
  legalVersion: string | null | undefined,
): boolean {
  if (!legalAcceptedAt) return true;
  if (!legalVersion || legalVersion !== CURRENT_POLICY_VERSION) return true;
  return false;
}
