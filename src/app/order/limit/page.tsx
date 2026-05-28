import Link from "next/link";
import { OrderShell } from "@/components/order/OrderShell";
import { OrderStepHeader } from "@/components/order/OrderStepHeader";
import { orderBtnPrimary } from "@/components/order/orderUi";

export default function OrderLimitPage() {
  return (
    <OrderShell contentWidth="medium" className="pb-10">
      <div className="flex flex-col items-center gap-6 text-center">
        <OrderStepHeader
          title="Orders temporarily unavailable"
          subtitle="This store has reached its monthly order limit. Please try again later."
        />
        <Link href="/" className={`inline-block px-6 ${orderBtnPrimary}`}>
          Back to home
        </Link>
      </div>
    </OrderShell>
  );
}
