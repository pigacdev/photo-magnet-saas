-- AlterTable
ALTER TABLE "Order" ADD COLUMN "buyerConfirmationEmailSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrderSession" ADD COLUMN "checkoutCustomerEmail" TEXT;
