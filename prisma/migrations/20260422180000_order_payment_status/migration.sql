-- Order.paymentStatus (idempotent if column already present from prior deploy)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'paymentStatus'
  ) THEN
    ALTER TABLE "Order" ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Order_paymentStatus_idx" ON "Order"("paymentStatus");

UPDATE "Order" SET "paymentStatus" = 'PAID' WHERE "status" = 'PAID' AND "paymentStatus" IS DISTINCT FROM 'PAID';
UPDATE "Order" SET "paymentStatus" = 'CASH' WHERE "status" = 'PENDING_CASH' AND "paymentStatus" IS DISTINCT FROM 'CASH';
