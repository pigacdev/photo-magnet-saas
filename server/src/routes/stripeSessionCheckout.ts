/**
 * POST /api/stripe/session-checkout — Stripe Checkout from an active OrderSession only
 * (no Order row, no finalize). Storefront and event online (card) compatible.
 */
import type { Request, Response } from "express";
import type { PrepareCommitError } from "../lib/orderSessionCheckoutCommit";
import { Prisma } from "../../../src/generated/prisma/client";
import {
  checkOrgOrderLimit,
  parseImageCopiesPayload,
  prepareOrderSessionCommit,
  resolveOrderStatusForFinalization,
} from "../lib/orderSessionCheckoutCommit";
import { prisma } from "../lib/prisma";
import { sessionConfig } from "../config/session";
import { getAppPublicUrl, getStripeOrNull } from "../lib/stripe";
import { validateOrderCustomerBody } from "../lib/orderCustomerValidation";
import { customerBodyFromOrderSessionRow } from "../lib/orderSessionPersistedCustomer";
import { validateOrderSessionContext } from "../lib/sessionContextValidation";
import { stripePaymentFieldsFromCheckoutSession } from "../lib/stripeOrderSessionSync";

function sendPrepareError(
  res: Response,
  err: PrepareCommitError,
) {
  if (err.status === 403 && err.code === "ORDER_LIMIT_REACHED") {
    res.status(403).json({
      code: err.code,
      message: err.message,
    });
    return;
  }
  res
    .status(err.status)
    .json("code" in err && err.code ? { error: err.error, code: err.code } : { error: err.error });
}

/** Same rule as POST /api/stripe/checkout-session for returnTo on success/cancel URLs. */
function safeReturnToFromSession(session: {
  contextType: string;
  contextId: string;
}): string {
  const id = session.contextId?.trim() ?? "";
  if (!id) return "";
  const path =
    session.contextType === "EVENT"
      ? `/event/${id}`
      : session.contextType === "STOREFRONT"
        ? `/store/${id}`
        : "";
  if (!/^\/(event|store)\/[a-zA-Z0-9_-]+$/.test(path)) return "";
  return `&returnTo=${encodeURIComponent(path)}`;
}

export async function handleStripeSessionCheckout(
  req: Request,
  res: Response,
): Promise<void> {
  const stripe = getStripeOrNull();
  if (!stripe) {
    res.status(503).json({ error: "Payment system not configured" });
    return;
  }

  const sessionId = req.cookies?.[sessionConfig.cookieName] as string | undefined;
  if (!sessionId) {
    res.status(400).json({ error: "Session required" });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const paymentMethod =
    typeof body.paymentMethod === "string" ? body.paymentMethod.trim().toLowerCase() : "";

  if (paymentMethod !== "stripe") {
    res.status(400).json({ error: "paymentMethod must be stripe" });
    return;
  }

  const sessionRow = await prisma.orderSession.findUnique({
    where: { id: String(sessionId) },
  });

  if (!sessionRow) {
    res.status(400).json({ error: "Session required" });
    return;
  }

  if (sessionRow.orderId != null) {
    res.status(400).json({
      error:
        "Order already exists for this session. Use POST /api/stripe/checkout-session with orderId.",
    });
    return;
  }

  const orderStatus = resolveOrderStatusForFinalization(
    sessionRow.contextType,
    paymentMethod,
  );
  if (orderStatus !== "PENDING_PAYMENT") {
    res.status(400).json({
      error: "Online card payment is not available for this checkout context",
    });
    return;
  }

  const fromSession = customerBodyFromOrderSessionRow(sessionRow);
  if (!fromSession) {
    res.status(400).json({
      error: "Save your customer details before continuing to payment",
    });
    return;
  }

  const validated = validateOrderCustomerBody(sessionRow.contextType, fromSession);
  if ("error" in validated) {
    res.status(400).json({ error: validated.error });
    return;
  }

  const now = new Date();
  const prep = await prepareOrderSessionCommit(
    sessionId,
    req.body,
    now,
    "PENDING_PAYMENT",
  );

  if (prep.ok === "idempotent") {
    res.status(400).json({
      error:
        "Order already exists for this session. Use POST /api/stripe/checkout-session with orderId.",
    });
    return;
  }
  if (!prep.ok) {
    sendPrepareError(res, prep.err);
    return;
  }

  const { prepared } = prep;
  const { session } = prepared;

  const contextOk = await validateOrderSessionContext(
    session.contextType,
    String(session.contextId),
  );
  if (!contextOk.ok) {
    if (contextOk.notFound) {
      res.status(404).json({ error: "Context not found" });
    } else {
      res.status(400).json({ error: contextOk.reason });
    }
    return;
  }

  const limitErr = await checkOrgOrderLimit(prepared.organizationId);
  if (limitErr) {
    sendPrepareError(res, limitErr);
    return;
  }

  const copiesForWebhook = parseImageCopiesPayload(req.body);
  await prisma.orderSession.update({
    where: { id: prepared.sessionRowId },
    data: {
      checkoutImageCopies:
        sessionRow.pricingType === "PER_ITEM" && copiesForWebhook
          ? (copiesForWebhook as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
    },
  });

  const total = Number(prepared.commitTotalPrice);
  const unitAmount = Math.round(total * 100);
  if (!Number.isFinite(unitAmount) || unitAmount < 1) {
    res.status(400).json({ error: "Invalid checkout total" });
    return;
  }

  const appUrl = getAppPublicUrl();
  const currency = prepared.currency.trim().toLowerCase();
  const n = prepared.sessionImages.length;
  const sessionRowId = prepared.sessionRowId;
  const returnToQ = safeReturnToFromSession({
    contextType: session.contextType,
    contextId: String(session.contextId),
  });

  const successBase = `${appUrl}/order/success`;
  const cancelBase = `${appUrl}/order/payment`;

  async function clearStaleStripeCheckoutSessionId(): Promise<void> {
    await prisma.orderSession.update({
      where: { id: sessionRowId },
      data: {
        stripeCheckoutSessionId: null,
        stripePaymentIntentId: null,
        stripePaymentStatus: null,
      },
    });
  }

  /** Only reuse an open, unpaid Stripe Checkout; never completed / paid / expired sessions. */
  function canReuseCheckoutFromStripe(
    os: { status: string; checkoutStage: string },
    stripeSession: { status: string | null; payment_status: string | null; url: string | null },
  ): boolean {
    if (os.status !== "ACTIVE") return false;
    if (os.checkoutStage === "COMPLETED") return false;
    if (stripeSession.status !== "open") return false;
    if (!stripeSession.url) return false;
    if (stripeSession.payment_status === "paid") return false;
    return true;
  }

  try {
    if (session.stripeCheckoutSessionId) {
      const orderSessionAllowsReuse =
        session.status === "ACTIVE" && session.checkoutStage !== "COMPLETED";

      if (!orderSessionAllowsReuse) {
        await clearStaleStripeCheckoutSessionId();
      } else {
        try {
          const existing = await stripe.checkout.sessions.retrieve(
            session.stripeCheckoutSessionId,
          );
          if (
            canReuseCheckoutFromStripe(session, {
              status: existing.status,
              payment_status: existing.payment_status,
              url: existing.url,
            })
          ) {
            console.info("[stripe.session-checkout] reuse existing session", {
              orderSessionId: sessionRowId,
              stripeSessionId: existing.id,
            });
            const stripePay = stripePaymentFieldsFromCheckoutSession(existing);
            await prisma.orderSession.update({
              where: { id: sessionRowId },
              data: {
                checkoutStage: "PAYMENT_PENDING",
                lastActiveAt: new Date(),
                stripePaymentIntentId: stripePay.stripePaymentIntentId,
                stripePaymentStatus: stripePay.stripePaymentStatus,
              },
            });
            res.json({ url: existing.url, stripeSessionId: existing.id });
            return;
          }
          console.info(
            "[stripe.session-checkout] stored Stripe session not reusable; clearing and creating new",
            {
              orderSessionId: sessionRowId,
              stripeSessionId: existing.id,
              stripeStatus: existing.status,
              paymentStatus: existing.payment_status,
            },
          );
          await clearStaleStripeCheckoutSessionId();
        } catch (retrieveErr) {
          console.warn(
            "[stripe.session-checkout] could not retrieve stored session; clearing and creating new",
            { orderSessionId: sessionRowId, err: retrieveErr },
          );
          await clearStaleStripeCheckoutSessionId();
        }
      }
    }

    const stripeSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      payment_intent_data: {
        metadata: {
          sessionId: sessionRowId,
        },
      },
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `Photo magnets (${n} item${n === 1 ? "" : "s"})`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        sessionId: sessionRowId,
        contextType: session.contextType,
        contextId: String(session.contextId),
      },
      success_url: `${successBase}?orderSessionId=${encodeURIComponent(sessionRowId)}${returnToQ}`,
      cancel_url: `${cancelBase}?orderSessionId=${encodeURIComponent(sessionRowId)}${returnToQ}`,
    });

    if (!stripeSession.url) {
      res.status(500).json({ error: "Could not start checkout" });
      return;
    }

    const createdPay = stripePaymentFieldsFromCheckoutSession(stripeSession);
    await prisma.orderSession.update({
      where: { id: sessionRowId },
      data: {
        stripeCheckoutSessionId: stripeSession.id,
        checkoutStage: "PAYMENT_PENDING",
        lastActiveAt: new Date(),
        stripePaymentIntentId: createdPay.stripePaymentIntentId,
        stripePaymentStatus: createdPay.stripePaymentStatus,
      },
    });

    res.json({ url: stripeSession.url, stripeSessionId: stripeSession.id });
  } catch (e) {
    console.error("[stripe.session-checkout]", e);
    res.status(500).json({ error: "Could not start checkout" });
  }
}
