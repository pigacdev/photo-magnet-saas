/**
 * Seller-facing print readiness (not raw payment enum).
 * READY_TO_PRINT = paid online OR event cash flow (both are OK to produce).
 */
export function isReadyToPrint(status: string): boolean {
  return status === "PAID" || status === "PENDING_CASH";
}

export function sellerPrintBadge(status: string): {
  label: string;
  className: string;
} {
  if (isReadyToPrint(status)) {
    return {
      label: "Ready",
      className: "bg-green-50 text-[#16A34A]",
    };
  }
  if (status === "PENDING_PAYMENT") {
    return {
      label: "Needs payment",
      className: "bg-amber-50 text-[#B45309]",
    };
  }
  return {
    label: "Pending",
    className: "bg-gray-100 text-[#6B7280]",
  };
}

export function SellerPrintStatusBadge({ status }: { status: string }) {
  const { label, className } = sellerPrintBadge(status);
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
