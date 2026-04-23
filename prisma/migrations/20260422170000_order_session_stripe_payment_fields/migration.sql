-- OrderSession: Stripe support/debug (before order row exists)
ALTER TABLE "OrderSession" ADD COLUMN "stripePaymentIntentId" TEXT;
ALTER TABLE "OrderSession" ADD COLUMN "stripePaymentStatus" TEXT;
