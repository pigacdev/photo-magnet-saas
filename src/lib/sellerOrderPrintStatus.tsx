import {
  isPrintEligibleStatus,
  isPrintPreviewEligibleStatus,
} from "@/lib/orderDisplayStatus";
export {
  computeOrderPrintProgress,
  countPrintableImages,
  countPrintedImages,
  countUnprintedImages,
  filterPrintableImages,
  orderIsFullyPrinted,
  orderNeedsPrintingAttention,
  type OrderImagePrintRow,
} from "@/lib/orderPrintProgress";

/** Seller print fulfillment: order must be paid or in production. */
export function isReadyToPrint(order: { status: string }): boolean {
  return isPrintEligibleStatus(order.status);
}

/** Seller print PDF preview: any active (non-cancelled) order. */
export function isReadyToPrintPreview(order: { status: string }): boolean {
  return isPrintPreviewEligibleStatus(order.status);
}

type OrderPrintProgressCellProps = {
  printedImages: number;
  totalImages: number;
};

export function OrderPrintProgressCell({
  printedImages,
  totalImages,
}: OrderPrintProgressCellProps) {
  if (totalImages === 0) {
    return <span className="text-muted-foreground">0</span>;
  }

  const unprintedImages = totalImages - printedImages;
  const allPrinted = unprintedImages === 0;

  return (
    <div className="space-y-0.5">
      <p
        className={`tabular-nums text-sm font-medium ${
          allPrinted ? "text-green-800 dark:text-green-400" : "text-orange-800 dark:text-orange-300"
        }`}
      >
        {printedImages}/{totalImages} printed
      </p>
      {!allPrinted ? (
        <p className="text-xs text-muted-foreground">
          {unprintedImages} unprinted
        </p>
      ) : null}
    </div>
  );
}
