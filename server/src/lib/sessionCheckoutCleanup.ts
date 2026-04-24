import { prisma } from "./prisma";
import { getStripeOrNull } from "./stripe";
import { expireOrderSessionOpenStripeCheckout } from "./stripeCheckoutSessionLifecycle";

/**
 * Mark stale in-progress sessions as EXPIRED + checkout ABANDONED.
 *
 * Includes session-first Stripe flows: there is no filter on `stripeCheckoutSessionId`.
 * Rows that never reached the webhook (abandoned Checkout) are still `ACTIVE` until
 * `expiresAt`, then expire here the same as cart-only sessions, including stages
 * `BUILDING`, `CUSTOMER_DETAILS`, and `PAYMENT_PENDING` (e.g. after redirect to Stripe).
 * File blobs are not deleted (handled in a later phase).
 */
export async function runStaleSessionCheckoutCleanup(now: Date = new Date()) {
  const toExpire = await prisma.orderSession.findMany({
    where: {
      status: "ACTIVE",
      checkoutStage: { in: ["BUILDING", "CUSTOMER_DETAILS", "PAYMENT_PENDING"] },
      expiresAt: { lte: now },
    },
    select: { id: true, stripeCheckoutSessionId: true },
  });
  const stripe = getStripeOrNull();
  for (const row of toExpire) {
    await expireOrderSessionOpenStripeCheckout(stripe, row.id, row.stripeCheckoutSessionId);
  }
  return prisma.orderSession.updateMany({
    where: {
      status: "ACTIVE",
      checkoutStage: { in: ["BUILDING", "CUSTOMER_DETAILS", "PAYMENT_PENDING"] },
      expiresAt: { lte: now },
    },
    data: {
      status: "EXPIRED",
      checkoutStage: "ABANDONED",
    },
  });
}
