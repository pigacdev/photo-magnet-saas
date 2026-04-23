-- CreateEnum: Session checkout lifecycle (separate from Order.status)
CREATE TYPE "SessionCheckoutStage" AS ENUM ('BUILDING', 'CUSTOMER_DETAILS', 'PAYMENT_PENDING', 'COMPLETED', 'ABANDONED');

-- AlterEnum: OrderSessionStatus
ALTER TYPE "OrderSessionStatus" ADD VALUE 'EXPIRED';

-- AlterTable: OrderSession.checkoutStage
ALTER TABLE "OrderSession" ADD COLUMN "checkoutStage" "SessionCheckoutStage" NOT NULL DEFAULT 'BUILDING';

CREATE INDEX "OrderSession_checkoutStage_idx" ON "OrderSession"("checkoutStage");

-- Backfill: align checkout stage with existing row status
UPDATE "OrderSession" SET "checkoutStage" = 'COMPLETED' WHERE "status" = 'CONVERTED';
UPDATE "OrderSession" SET "checkoutStage" = 'ABANDONED' WHERE "status" = 'ABANDONED';
