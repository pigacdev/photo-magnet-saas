/**
 * Shared legal / policy constants (frontend + referenced in docs).
 * Bump CURRENT_POLICY_VERSION when Terms or Privacy materially change to force seller re-consent.
 */

export const CURRENT_POLICY_VERSION = "2026-07-14";

/** Platform operator identity (update before production launch). */
export const LEGAL_ENTITY = {
  name: "Magnetoo",
  contactEmail: "magnetooprints@gmail.com",
  /** Physical address for GDPR / imprint — replace with registered business address. */
  address: "Croatia, European Union",
} as const;

/** Default retention windows (mirror server env defaults; document in Privacy Policy). */
export const LEGAL_RETENTION_DEFAULTS = {
  abandonedSessionMediaHours: 48,
  orderMediaDays: 30,
  eventMediaHoursAfterEnd: 24,
  printSheetHours: 24,
  orderPiiDays: 365,
  accountErasureGraceDays: 30,
} as const;

export const LEGAL_LINKS = {
  privacy: "/privacy",
  terms: "/terms",
  cookies: "/cookies",
  subprocessors: "/subprocessors",
  imprint: "/imprint",
  dpa: "/dashboard/billing",
} as const;
