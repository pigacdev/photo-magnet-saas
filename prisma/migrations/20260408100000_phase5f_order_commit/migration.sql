-- Phase 5F: replace legacy Order/Image/Print with committed Order + OrderImage

DROP TABLE IF EXISTS "PrintBatchItem";
DROP TABLE IF EXISTS "PrintBatch";
DROP TABLE IF EXISTS "Image";
DROP TABLE IF EXISTS "Order";

CREATE TYPE "OrderCommitStatus" AS ENUM ('PENDING_CASH', 'PENDING_PAYMENT');

CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contextType" "ContextType" NOT NULL,
    "contextId" TEXT NOT NULL,
    "status" "OrderCommitStatus" NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderImage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "croppedUrl" TEXT,
    "cropX" INTEGER NOT NULL,
    "cropY" INTEGER NOT NULL,
    "cropWidth" INTEGER NOT NULL,
    "cropHeight" INTEGER NOT NULL,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Order_organizationId_idx" ON "Order"("organizationId");
CREATE INDEX "Order_contextType_contextId_idx" ON "Order"("contextType", "contextId");
CREATE INDEX "Order_status_idx" ON "Order"("status");

CREATE INDEX "OrderImage_orderId_idx" ON "OrderImage"("orderId");
CREATE INDEX "OrderImage_orderId_position_idx" ON "OrderImage"("orderId", "position");

ALTER TABLE "Order" ADD CONSTRAINT "Order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderImage" ADD CONSTRAINT "OrderImage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
