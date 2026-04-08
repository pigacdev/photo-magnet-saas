-- Idempotent order commit: link session to created order.

ALTER TABLE "OrderSession" ADD COLUMN "orderId" TEXT;

CREATE UNIQUE INDEX "OrderSession_orderId_key" ON "OrderSession"("orderId");

ALTER TABLE "OrderSession" ADD CONSTRAINT "OrderSession_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
