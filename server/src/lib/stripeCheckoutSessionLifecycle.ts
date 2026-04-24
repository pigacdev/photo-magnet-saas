import type Stripe from "stripe";

type CheckoutSessionsExpire = (id: string) => Promise<Stripe.Checkout.Session>;

/**
 * If the Checkout Session is still `open` in Stripe, mark it expired so the hosted
 * payment URL can no longer collect payment. Never throws: logs warnings only.
 */
export async function expireStripeCheckoutSessionIfOpen(
  stripe: Stripe,
  stripeCheckoutSessionId: string | null | undefined,
): Promise<void> {
  if (stripeCheckoutSessionId == null || !String(stripeCheckoutSessionId).trim()) {
    return;
  }
  const id = String(stripeCheckoutSessionId).trim();
  let retrieved: Stripe.Checkout.Session;
  try {
    retrieved = await stripe.checkout.sessions.retrieve(id);
  } catch (e) {
    if (isBenignSessionRetrieveError(e)) {
      return;
    }
    console.warn("[stripe.checkout] could not retrieve checkout session before expire; continuing", {
      stripeSessionId: id,
      err: e,
    });
    return;
  }
  if (retrieved.status !== "open") {
    return;
  }
  try {
    await expireCheckoutSessionById(stripe, id);
    console.info("[stripe.checkout] expired stale session", { stripeSessionId: id });
  } catch (e) {
    if (isBenignSessionExpireError(e)) {
      return;
    }
    console.warn("[stripe.checkout] could not expire checkout session; continuing", {
      stripeSessionId: id,
      err: e,
    });
  }
}

/**
 * Before clearing `OrderSession.stripeCheckoutSessionId`, logs correlation and runs
 * {@link expireStripeCheckoutSessionIfOpen} (no-op when Stripe is not configured or id is empty).
 * Never throws.
 */
export async function expireOrderSessionOpenStripeCheckout(
  stripe: Stripe | null,
  orderSessionId: string,
  stripeCheckoutSessionId: string | null | undefined,
): Promise<void> {
  if (!stripe || !stripeCheckoutSessionId) return;
  console.info("[stripe.checkout] stale session expired", {
    orderSessionId,
    stripeSessionId: stripeCheckoutSessionId,
  });
  await expireStripeCheckoutSessionIfOpen(stripe, stripeCheckoutSessionId);
}

type StripeErrorLike = {
  type?: string;
  code?: string;
  message?: string;
  statusCode?: number;
};

function isBenignSessionRetrieveError(err: unknown): boolean {
  const e = err as StripeErrorLike;
  if (e?.statusCode === 404) return true;
  if (e?.code === "resource_missing") return true;
  const msg = String(e?.message ?? "").toLowerCase();
  if (msg.includes("no such checkout.sessions") || msg.includes("no such session")) {
    return true;
  }
  return false;
}

function isBenignSessionExpireError(err: unknown): boolean {
  const e = err as StripeErrorLike;
  if (e?.statusCode === 404) return true;
  if (e?.code === "resource_missing") return true;
  const msg = String(e?.message ?? "").toLowerCase();
  if (msg.includes("cannot be expired")) return true;
  if (msg.includes("already been completed") || msg.includes("already been expired")) {
    return true;
  }
  if (msg.includes("already completed")) return true;
  if (msg.includes("already expired")) return true;
  if (msg.includes("not in an") && (msg.includes("expirable") || msg.includes("expireable"))) {
    return true;
  }
  if (e?.type === "StripeInvalidRequestError" && (e.code === "session_not_open" || e.code === "resource_already_frozen")) {
    return true;
  }
  return false;
}

function expireCheckoutSessionById(
  stripe: Stripe,
  id: string,
): Promise<Stripe.Checkout.Session> {
  return (stripe.checkout.sessions as unknown as { expire: CheckoutSessionsExpire }).expire(id);
}
