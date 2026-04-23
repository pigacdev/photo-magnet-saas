-- OrderSession: track Stripe Checkout before an Order row exists (session-first payment).
ALTER TABLE "OrderSession" ADD COLUMN "stripeCheckoutSessionId" TEXT;
