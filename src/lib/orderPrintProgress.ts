import { isPrintEligibleStatus } from "@/lib/orderDisplayStatus";

export type OrderImagePrintRow = {
  printed: boolean;
  mediaDeletedAt: Date | null;
};

export function filterPrintableImages<T extends OrderImagePrintRow>(
  images: T[],
): T[] {
  return images.filter((img) => img.mediaDeletedAt == null);
}

export function countPrintableImages(images: OrderImagePrintRow[]): number {
  return filterPrintableImages(images).length;
}

export function countPrintedImages(images: OrderImagePrintRow[]): number {
  return filterPrintableImages(images).filter((img) => img.printed).length;
}

export function countUnprintedImages(images: OrderImagePrintRow[]): number {
  return filterPrintableImages(images).filter((img) => !img.printed).length;
}

export function orderIsFullyPrinted(images: OrderImagePrintRow[]): boolean {
  const printable = filterPrintableImages(images);
  return printable.length > 0 && printable.every((img) => img.printed);
}

/** Print-eligible order with at least one unprinted printable image. */
export function orderNeedsPrintingAttention(
  status: string,
  images: OrderImagePrintRow[],
): boolean {
  if (!isPrintEligibleStatus(status)) return false;
  return countUnprintedImages(images) > 0;
}

export function computeOrderPrintProgress(images: OrderImagePrintRow[]): {
  totalImages: number;
  printedImages: number;
  unprintedImages: number;
} {
  const printable = filterPrintableImages(images);
  const totalImages = printable.length;
  const printedImages = printable.filter((img) => img.printed).length;
  return {
    totalImages,
    printedImages,
    unprintedImages: totalImages - printedImages,
  };
}
