-- AlterTable
ALTER TABLE "OrderSession" ADD COLUMN     "bundleId" TEXT,
ADD COLUMN     "pricingType" "PricingType",
ADD COLUMN     "quantity" INTEGER,
ADD COLUMN     "selectedShapeId" TEXT,
ADD COLUMN     "totalPrice" DECIMAL(10,2);
