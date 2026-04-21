-- AlterTable
ALTER TABLE "Order" ADD COLUMN "paymentStatus" VARCHAR(16) NOT NULL DEFAULT 'UNPAID';

-- Paid orders (online checkout completed) were effectively paid already
UPDATE "Order" SET "paymentStatus" = 'PAID' WHERE "status" = 'PAID';
