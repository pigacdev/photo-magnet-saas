import type Stripe from "stripe";

/**
 * Read PaymentIntent id + Checkout `payment_status` from a Checkout Session
 * (not PaymentIntent.status — that is a different string).
 */
export function stripePaymentFieldsFromCheckoutSession(
  s: Stripe.Checkout.Session,
): {
  stripePaymentIntentId: string | null;
  stripePaymentStatus: string | null;
} {
  const pi = s.payment_intent;
  let stripePaymentIntentId: string | null = null;
  if (typeof pi === "string") {
    stripePaymentIntentId = pi;
  } else if (pi && typeof pi === "object" && "id" in pi) {
    stripePaymentIntentId = String((pi as { id: string }).id);
  }
  const ps = s.payment_status;
  return {
    stripePaymentIntentId,
    stripePaymentStatus: ps != null && String(ps) !== "" ? String(ps) : null,
  };
}
