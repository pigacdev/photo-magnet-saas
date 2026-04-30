-- AlterTable
ALTER TABLE "OrderImage" ADD COLUMN "mediaDeletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "OrderImage_orderId_mediaDeletedAt_idx" ON "OrderImage"("orderId", "mediaDeletedAt");
