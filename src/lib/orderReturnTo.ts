/**
 * Allowed post–order-flow redirects: same-origin entry pages only (no open redirects).
 * Accepts a path like `/event/<id>` or `/store/<id>` where id is a non-empty slug (UUID-safe).
 */
const ENTRY_RETURN_PATH = /^\/(event|store)\/[a-zA-Z0-9_-]+$/;

/**
 * Returns a safe pathname to redirect to after session loss, or null to fall back to home.
 */
export function getSafeOrderReturnTo(raw: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.includes("//") || trimmed.includes("..")) return null;
  const pathOnly = trimmed.split("?")[0]?.split("#")[0] ?? "";
  if (!ENTRY_RETURN_PATH.test(pathOnly)) return null;
  return pathOnly;
}

export function buildOrderUrlWithReturn(returnPath: string): string {
  const safe = getSafeOrderReturnTo(returnPath);
  if (!safe) return "/order";
  return `/order?returnTo=${encodeURIComponent(safe)}`;
}

/** Entry page for a committed order’s catalog context (same rules as `getSafeOrderReturnTo`). */
export function orderContextToEntryPath(
  contextType: "EVENT" | "STOREFRONT" | undefined,
  contextId: string | undefined,
): string | null {
  if (!contextType || !contextId?.trim()) return null;
  const path =
    contextType === "EVENT"
      ? `/event/${contextId.trim()}`
      : `/store/${contextId.trim()}`;
  return getSafeOrderReturnTo(path);
}
