const listeners = new Set<() => void>();

/** Subscribe to new-orders count invalidation (sidebar badge refresh). */
export function subscribeNewOrdersCount(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Trigger an immediate refetch of the sidebar new-orders badge count. */
export function invalidateNewOrdersCount(): void {
  listeners.forEach((listener) => listener());
}
