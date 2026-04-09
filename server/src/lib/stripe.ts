import Stripe from "stripe";

console.log("STRIPE KEY:", process.env.STRIPE_SECRET_KEY ? "FOUND" : "MISSING");

let stripeInstance: Stripe | null = null;

export function getStripeOrNull(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return null;
  }

  if (!stripeInstance) {
    stripeInstance = new Stripe(key, {
      apiVersion: "2026-03-25.dahlia",
    });
  }

  return stripeInstance;
}

export function getAppPublicUrl(): string {
  const raw =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}
