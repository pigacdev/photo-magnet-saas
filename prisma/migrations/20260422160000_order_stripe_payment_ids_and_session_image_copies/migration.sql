-- Order: Stripe payment references (session-first webhook)
ALTER TABLE "Order" ADD COLUMN "stripePaymentIntentId" TEXT;
ALTER TABLE "Order" ADD COLUMN "stripeChargeId" TEXT;

-- OrderSession: PER_ITEM copy snapshot for webhook finalize (same as session-checkout body)
ALTER TABLE "OrderSession" ADD COLUMN "checkoutImageCopies" JSONB;
