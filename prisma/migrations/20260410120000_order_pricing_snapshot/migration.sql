-- Immutable pricing snapshot on Order (copied from OrderSession at commit).

ALTER TABLE "Order" ADD COLUMN "pricingType" "PricingType";
ALTER TABLE "Order" ADD COLUMN "quantity" INTEGER;
ALTER TABLE "Order" ADD COLUMN "bundleId" TEXT;

UPDATE "Order" SET "pricingType" = 'PER_ITEM' WHERE "pricingType" IS NULL;

ALTER TABLE "Order" ALTER COLUMN "pricingType" SET NOT NULL;
