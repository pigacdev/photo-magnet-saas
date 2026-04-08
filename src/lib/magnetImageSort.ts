/**
 * Client-side sort matching server `SESSION_IMAGE_LIST_ORDER_BY`:
 * position ASC, then createdAt ASC (tie-break).
 */
export function compareMagnetImagesByPosition<
  T extends { position: number; createdAt: string },
>(a: T, b: T): number {
  const d = a.position - b.position;
  if (d !== 0) return d;
  return a.createdAt.localeCompare(b.createdAt);
}

export function sortMagnetImagesByPosition<
  T extends { position: number; createdAt: string },
>(images: T[]): T[] {
  return [...images].sort(compareMagnetImagesByPosition);
}
