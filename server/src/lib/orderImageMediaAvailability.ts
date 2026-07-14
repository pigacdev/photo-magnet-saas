/**
 * OrderImage rows retain DB records after retention cleanup; blobs are gone when
 * `mediaDeletedAt` or seller GDPR `deletedAt` is set.
 */

export function allOrderImagesMediaRemoved(
  images: { mediaDeletedAt: Date | null; deletedAt?: Date | null }[],
): boolean {
  return (
    images.length > 0 &&
    images.every(
      (img) => img.mediaDeletedAt != null || img.deletedAt != null,
    )
  );
}

export function filterPrintableOrderImages<
  T extends { mediaDeletedAt: Date | null; deletedAt?: Date | null },
>(images: T[]): T[] {
  return images.filter(
    (img) => img.mediaDeletedAt == null && img.deletedAt == null,
  );
}
