-- Storefront online payment: PAID status + Stripe Checkout session id (webhook).

ALTER TYPE "OrderCommitStatus" ADD VALUE 'PAID';

ALTER TABLE "Order" ADD COLUMN "stripeCheckoutSessionId" TEXT;
