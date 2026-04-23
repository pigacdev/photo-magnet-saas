import { CHECKOUT_IMAGE_COPIES_STORAGE_KEY } from "@/lib/orderSessionTypes";

export type CheckoutImageCopyRow = { imageId: string; copies: number };

/**
 * Per-image copy counts for active checkout (per-item pricing).
 * Survives review ↔ crop ↔ customer navigation within the same browser tab.
 */
export function readCheckoutImageCopies(): CheckoutImageCopyRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(CHECKOUT_IMAGE_COPIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: CheckoutImageCopyRow[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const imageId = (row as { imageId?: unknown }).imageId;
      const copies = (row as { copies?: unknown }).copies;
      if (typeof imageId !== "string" || !imageId.trim()) continue;
      if (typeof copies !== "number" || !Number.isInteger(copies) || copies < 1) {
        continue;
      }
      out.push({ imageId: imageId.trim(), copies });
    }
    return out;
  } catch {
    return [];
  }
}

export function writeCheckoutImageCopies(rows: CheckoutImageCopyRow[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      CHECKOUT_IMAGE_COPIES_STORAGE_KEY,
      JSON.stringify(rows),
    );
  } catch {
    // ignore quota / private mode
  }
}

export function clearCheckoutImageCopies(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(CHECKOUT_IMAGE_COPIES_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * For each current image id, use stored copy count if valid, else 1.
 * Call for per_item sessions on review mount / when image list changes.
 */
export function buildCopiesRecordFromImageIds(
  imageIds: string[],
  isPerItem: boolean,
): Record<string, number> {
  if (!isPerItem) return {};
  const stored = readCheckoutImageCopies();
  const byId = new Map(stored.map((r) => [r.imageId, r.copies]));
  const next: Record<string, number> = {};
  for (const id of imageIds) {
    const c = byId.get(id);
    next[id] = typeof c === "number" && c >= 1 ? c : 1;
  }
  return next;
}

export function buildCopyRowsFromState(
  images: { id: string }[],
  copiesByImageId: Record<string, number>,
): CheckoutImageCopyRow[] {
  return images.map((img) => ({
    imageId: img.id,
    copies: copiesByImageId[img.id] ?? 1,
  }));
}

/**
 * Call before following a link to the crop page so counts are on disk in case of a fast click.
 */
export function persistCopyCountsNow(
  images: { id: string }[],
  copiesByImageId: Record<string, number>,
  isPerItem: boolean,
): void {
  if (!isPerItem) {
    clearCheckoutImageCopies();
    return;
  }
  writeCheckoutImageCopies(buildCopyRowsFromState(images, copiesByImageId));
}
