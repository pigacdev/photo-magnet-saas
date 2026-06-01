-- Order workflow: replace OrderCommitStatus + PaymentStatus with OrderStatus

CREATE TYPE "OrderStatus" AS ENUM (
  'NEW',
  'CONFIRMED',
  'INVOICE_SENT',
  'PAID',
  'IN_PRODUCTION',
  'SHIPPED',
  'COMPLETED',
  'CANCELLED'
);

ALTER TABLE "Order" ADD COLUMN "status_new" "OrderStatus";

UPDATE "Order"
SET "status_new" = 'NEW'
WHERE "status"::text IN ('PENDING_PAYMENT', 'PENDING_CASH');

UPDATE "Order"
SET "status_new" = 'SHIPPED'
WHERE "status"::text = 'PAID' AND "shippedAt" IS NOT NULL;

UPDATE "Order"
SET "status_new" = 'IN_PRODUCTION'
WHERE "status"::text = 'PAID'
  AND "printedAt" IS NOT NULL
  AND "shippedAt" IS NULL;

UPDATE "Order"
SET "status_new" = 'PAID'
WHERE "status"::text = 'PAID'
  AND "printedAt" IS NULL
  AND "shippedAt" IS NULL;

-- Fallback for any unmigrated PAID rows
UPDATE "Order"
SET "status_new" = 'PAID'
WHERE "status_new" IS NULL AND "status"::text = 'PAID';

UPDATE "Order"
SET "status_new" = 'NEW'
WHERE "status_new" IS NULL;

ALTER TABLE "Order" DROP COLUMN "status";
ALTER TABLE "Order" RENAME COLUMN "status_new" TO "status";
ALTER TABLE "Order" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'NEW';

ALTER TABLE "Order" DROP COLUMN "paymentStatus";

ALTER TABLE "Order" ADD COLUMN "eventPaymentPreference" TEXT;

DROP TYPE "OrderCommitStatus";
DROP TYPE "PaymentStatus";

-- SessionCheckoutStage: remove PAYMENT_PENDING
UPDATE "OrderSession"
SET "checkoutStage" = 'CUSTOMER_DETAILS'
WHERE "checkoutStage"::text = 'PAYMENT_PENDING';

CREATE TYPE "SessionCheckoutStage_new" AS ENUM (
  'BUILDING',
  'CUSTOMER_DETAILS',
  'COMPLETED',
  'ABANDONED'
);

ALTER TABLE "OrderSession"
  ALTER COLUMN "checkoutStage" DROP DEFAULT;

ALTER TABLE "OrderSession"
  ALTER COLUMN "checkoutStage" TYPE "SessionCheckoutStage_new"
  USING ("checkoutStage"::text::"SessionCheckoutStage_new");

DROP TYPE "SessionCheckoutStage";
ALTER TYPE "SessionCheckoutStage_new" RENAME TO "SessionCheckoutStage";

ALTER TABLE "OrderSession"
  ALTER COLUMN "checkoutStage" SET DEFAULT 'BUILDING';
