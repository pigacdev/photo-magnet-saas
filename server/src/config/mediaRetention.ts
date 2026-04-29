/**
 * Central retention knobs for media lifecycle (Phase 1: config only; no deletion).
 * Values are read once at module load from the environment with safe fallbacks.
 */

function readNonNegativeIntEnv(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return defaultValue;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return defaultValue;
  return n;
}

/** Hours to retain blobs for abandoned / expired checkout sessions after the retention anchor. Default 48. */
export const ABANDONED_SESSION_MEDIA_RETENTION_HOURS = readNonNegativeIntEnv(
  "ABANDONED_SESSION_MEDIA_RETENTION_HOURS",
  48,
);

/** Days to retain order-scoped images (originals, crops, rendered assets). Default 30. */
export const ORDER_MEDIA_RETENTION_DAYS = readNonNegativeIntEnv(
  "ORDER_MEDIA_RETENTION_DAYS",
  30,
);

/**
 * Hours after an event's `endDate` before event-context media may be eligible for cleanup.
 * Default 24.
 */
export const EVENT_MEDIA_RETENTION_HOURS_AFTER_END = readNonNegativeIntEnv(
  "EVENT_MEDIA_RETENTION_HOURS_AFTER_END",
  24,
);

/** Hours to retain generated print-sheet PDFs on disk (future job). Default 24. */
export const PRINT_SHEET_RETENTION_HOURS = readNonNegativeIntEnv(
  "PRINT_SHEET_RETENTION_HOURS",
  24,
);

// --- Media categories (labels for jobs / logging; not DB enums) ---

/** Session images and uploads tied to `OrderSession` / `SessionImage`. */
export const MEDIA_CATEGORY_SESSION_MEDIA = "SESSION_MEDIA" as const;

/** Order images: originals, crops, rendered magnet assets (`OrderImage`). */
export const MEDIA_CATEGORY_ORDER_MEDIA = "ORDER_MEDIA" as const;

/** Generated seller print PDFs (print pipeline output). */
export const MEDIA_CATEGORY_PRINT_MEDIA = "PRINT_MEDIA" as const;

/** Assets grouped by event `contextId` (and related session/order rows for that context). */
export const MEDIA_CATEGORY_EVENT_MEDIA = "EVENT_MEDIA" as const;

export type MediaCategory =
  | typeof MEDIA_CATEGORY_SESSION_MEDIA
  | typeof MEDIA_CATEGORY_ORDER_MEDIA
  | typeof MEDIA_CATEGORY_PRINT_MEDIA
  | typeof MEDIA_CATEGORY_EVENT_MEDIA;
