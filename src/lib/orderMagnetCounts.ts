export type PricingTypeForCopies = "per_item" | "bundle" | null;

export function usesImageCopies(pricingType: PricingTypeForCopies): boolean {
  return pricingType === "per_item" || pricingType === "bundle";
}

export function sumImageCopies(
  imageIds: string[],
  copiesByImageId: Record<string, number>,
): number {
  let total = 0;
  for (const id of imageIds) {
    const c = copiesByImageId[id];
    total += typeof c === "number" && c >= 1 ? c : 1;
  }
  return total;
}

export function remainingMagnets(required: number, total: number): number {
  return Math.max(0, required - total);
}

export function canAddMorePhotos(opts: {
  imagesCount: number;
  requiredMagnets: number;
  totalMagnets: number;
}): boolean {
  const { imagesCount, requiredMagnets, totalMagnets } = opts;
  if (imagesCount >= requiredMagnets) return false;
  if (totalMagnets >= requiredMagnets) return false;
  return true;
}

export function isBundleMagnetAllocationComplete(
  required: number,
  total: number,
): boolean {
  return required > 0 && total === required;
}
