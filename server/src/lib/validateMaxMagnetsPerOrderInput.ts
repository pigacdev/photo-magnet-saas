import { SYSTEM_MAX_MAGNETS_PER_ORDER } from "../config/system";

/**
 * Parse `maxMagnetsPerOrder` from create/update body (when the field is present).
 * - null → clear business limit.
 * - integer in [1, SYSTEM_MAX_MAGNETS_PER_ORDER] → set.
 */
export function parseMaxMagnetsPerOrderInput(
  value: unknown,
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === null) return { ok: true, value: null };
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { ok: false, error: "maxMagnetsPerOrder must be an integer or null" };
  }
  if (value < 1) {
    return {
      ok: false,
      error: "maxMagnetsPerOrder must be at least 1 or null",
    };
  }
  if (value > SYSTEM_MAX_MAGNETS_PER_ORDER) {
    return {
      ok: false,
      error: `Maximum allowed is ${SYSTEM_MAX_MAGNETS_PER_ORDER}`,
    };
  }
  return { ok: true, value };
}
