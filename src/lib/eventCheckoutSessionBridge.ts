/**
 * Persists per-image copy counts between Review and Customer steps for EVENT checkout
 * (session stays active until POST /api/orders from the customer page).
 */
export type EventCheckoutCopiesPayload = {
  imageCopies: { imageId: string; copies: number }[];
};

function key(sessionId: string): string {
  return `photoMagnetEventCheckout:${sessionId}`;
}

export function writeEventCheckoutCopies(
  sessionId: string,
  payload: EventCheckoutCopiesPayload,
): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(key(sessionId), JSON.stringify(payload));
}

/** Resolves copies per session image id; defaults to 1 when missing or invalid. */
export function readEventCheckoutCopies(
  sessionId: string,
  imageIds: string[],
): Record<string, number> {
  const fallback = (): Record<string, number> =>
    Object.fromEntries(imageIds.map((id) => [id, 1]));
  if (typeof sessionStorage === "undefined") return fallback();
  try {
    const raw = sessionStorage.getItem(key(sessionId));
    if (!raw) return fallback();
    const data = JSON.parse(raw) as EventCheckoutCopiesPayload;
    if (!data?.imageCopies || !Array.isArray(data.imageCopies)) return fallback();
    const map = new Map(
      data.imageCopies.map((r) => [r.imageId, r.copies] as const),
    );
    const out: Record<string, number> = {};
    for (const id of imageIds) {
      const c = map.get(id);
      out[id] = typeof c === "number" && c >= 1 ? c : 1;
    }
    return out;
  } catch {
    return fallback();
  }
}

export function clearEventCheckoutCopies(sessionId: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(key(sessionId));
}
