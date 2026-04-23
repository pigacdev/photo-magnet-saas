-- OrderSession: persist customer + shipping for session-first Stripe (webhook can finalize without re-posting form body)
ALTER TABLE "OrderSession" ADD COLUMN     "checkoutCustomerName" TEXT;
ALTER TABLE "OrderSession" ADD COLUMN     "checkoutCustomerPhone" TEXT;
ALTER TABLE "OrderSession" ADD COLUMN     "checkoutShippingType" TEXT;
ALTER TABLE "OrderSession" ADD COLUMN     "checkoutShippingAddress" JSONB;
