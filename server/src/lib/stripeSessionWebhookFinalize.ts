import Stripe from "stripe";
import { prisma } from "./prisma";
import {
  checkOrgOrderLimit,
  parseImageCopiesPayload,
  prepareOrderSessionCommit,
  runOrderCommitTransaction,
  toOrderCustomerInsertFromValidated,
} from "./orderSessionCheckoutCommit";
import { validateOrderCustomerBody } from "./orderCustomerValidation";
import { customerBodyFromOrderSessionRow } from "./orderSessionPersistedCustomer";
import { validateOrderSessionContext } from "./sessionContextValidation";
import { ORDER_IMAGE_LIST_ORDER_BY } from "./magnetImageOrderBy";
import { expandOrderImagesForPrintSheet, generatePrintSheet } from "./generatePrintSheet";
import { renderOrderImages } from "./renderOrderImages";
import { stripePaymentFieldsFromCheckoutSession } from "./stripeOrderSessionSync";

export type SessionCheckoutWebhookResult =
  | { ok: true; orderId: string; alreadyPaid: boolean }
  | { ok: false; reason: string };

function buildPrepareBodyFromOrderSession(
  row: {
    pricingType: string | null;
    checkoutImageCopies: unknown;
  },
): Record<string, unknown> {
  if (row.pricingType === "PER_ITEM") {
    if (row.checkoutImageCopies == null) {
      return {};
    }
    if (!Array.isArray(row.checkoutImageCopies)) {
      return {};
    }
    return { imageCopies: row.checkoutImageCopies };
  }
  return {};
}

function extractPaidStripeIds(
  fullSession: Stripe.Checkout.Session,
): { paymentIntentId: string | null; chargeId: string | null } {
  const pi = fullSession.payment_intent;
  let paymentIntentId: string | null = null;
  if (typeof pi === "string") {
    paymentIntentId = pi;
  } else if (pi && typeof pi === "object" && "id" in pi) {
    paymentIntentId = (pi as Stripe.PaymentIntent).id;
  }
  let chargeId: string | null = null;
  if (pi && typeof pi === "object" && "latest_charge" in (pi as Stripe.PaymentIntent)) {
    const lc = (pi as Stripe.PaymentIntent).latest_charge;
    if (typeof lc === "string") chargeId = lc;
    else if (lc && typeof lc === "object" && "id" in lc) {
      chargeId = (lc as Stripe.Charge).id;
    }
  }
  return { paymentIntentId, chargeId };
}

/**
 * checkout.session.completed for session-first flow (metadata.sessionId, no metadata.orderId).
 * Idempotent: FOR UPDATE in runOrderCommitTransaction; early exit if order already exists PAID.
 */
export async function processSessionFirstCheckoutSessionCompleted(
  stripe: Stripe,
  eventSession: Stripe.Checkout.Session,
): Promise<SessionCheckoutWebhookResult> {
  if (eventSession.mode === "subscription") {
    return { ok: false, reason: "not payment mode" };
  }

  const orderSessionId = eventSession.metadata?.sessionId
    ? String(eventSession.metadata.sessionId).trim()
    : "";
  if (!orderSessionId) {
    return { ok: false, reason: "missing sessionId metadata" };
  }

  const fullSession = await stripe.checkout.sessions.retrieve(String(eventSession.id), {
    expand: ["payment_intent", "payment_intent.latest_charge"],
  });

  if (fullSession.payment_status !== "paid") {
    return {
      ok: false,
      reason: `checkout session not paid: ${String(fullSession.payment_status)}`,
    };
  }

  const payFields = stripePaymentFieldsFromCheckoutSession(fullSession);

  const row = await prisma.orderSession.findUnique({
    where: { id: orderSessionId },
    include: { order: true },
  });
  if (!row) {
    return { ok: false, reason: "OrderSession not found" };
  }

  await prisma.orderSession.update({
    where: { id: orderSessionId },
    data: {
      stripePaymentIntentId: payFields.stripePaymentIntentId,
      stripePaymentStatus: payFields.stripePaymentStatus,
    },
  });

  if (row.orderId) {
    if (row.order?.status === "PAID") {
      return { ok: true, orderId: row.orderId, alreadyPaid: true };
    }
  }

  if (
    row.stripeCheckoutSessionId != null &&
    String(row.stripeCheckoutSessionId) !== String(fullSession.id)
  ) {
    return {
      ok: false,
      reason: "OrderSession.stripeCheckoutSessionId does not match this Checkout Session",
    };
  }

  const now = new Date();
  const fromCustomer = customerBodyFromOrderSessionRow(row);
  if (!fromCustomer) {
    return { ok: false, reason: "missing persisted customer on OrderSession" };
  }

  const validated = validateOrderCustomerBody(row.contextType, fromCustomer);
  if ("error" in validated) {
    return { ok: false, reason: `customer invalid: ${validated.error}` };
  }

  const prepareBody = buildPrepareBodyFromOrderSession({
    pricingType: row.pricingType,
    checkoutImageCopies: row.checkoutImageCopies,
  });

  if (row.pricingType === "PER_ITEM") {
    if (!parseImageCopiesPayload(prepareBody)) {
      return {
        ok: false,
        reason: "PER_ITEM order missing checkoutImageCopies; restart checkout from review",
      };
    }
  }

  const prep = await prepareOrderSessionCommit(
    orderSessionId,
    prepareBody,
    now,
    "PENDING_PAYMENT",
  );

  if (prep.ok === "idempotent") {
    if (prep.status === "PAID") {
      return { ok: true, orderId: prep.orderId, alreadyPaid: true };
    }
    return {
      ok: false,
      reason: `OrderSession has order in status ${prep.status}; cannot finalize again`,
    };
  }
  if (!prep.ok) {
    return { ok: false, reason: `prepare failed: ${prep.err.error}` };
  }

  const { prepared } = prep;
  const contextOk = await validateOrderSessionContext(
    prepared.session.contextType,
    String(prepared.session.contextId),
  );
  if (!contextOk.ok) {
    return {
      ok: false,
      reason: contextOk.notFound ? "context not found" : String(contextOk.reason),
    };
  }

  const expectedCents = Math.round(Number(prepared.commitTotalPrice) * 100);
  const got = fullSession.amount_total;
  if (typeof got === "number" && got !== expectedCents) {
    return {
      ok: false,
      reason: `amount mismatch: expected ${expectedCents} got ${String(got)}`,
    };
  }

  const limitErr = await checkOrgOrderLimit(prepared.organizationId);
  if (limitErr) {
    return { ok: false, reason: `org limit: ${limitErr.error}` };
  }

  const { paymentIntentId, chargeId } = extractPaidStripeIds(fullSession);

  const result = await runOrderCommitTransaction(
    prepared,
    toOrderCustomerInsertFromValidated(validated.data),
    {
      stripeCheckoutSessionId: String(fullSession.id),
      stripePaymentIntentId: paymentIntentId,
      stripeChargeId: chargeId,
    },
  );

  if (result.kind === "IDEMPOTENT") {
    return { ok: true, orderId: result.orderId, alreadyPaid: true };
  }
  return { ok: true, orderId: result.orderId, alreadyPaid: false };
}

/**
 * Render + print PDFs (same as legacy order Stripe webhook) — safe to call after PAID order exists.
 */
export async function runSessionWebhookPostPaymentOrderProcessing(
  orderId: string,
): Promise<void> {
  const orderImages = await prisma.orderImage.findMany({
    where: { orderId },
    orderBy: ORDER_IMAGE_LIST_ORDER_BY,
  });
  try {
    await renderOrderImages(
      orderId,
      orderImages.map((img) => ({
        id: img.id,
        originalUrl: img.originalUrl,
        cropX: img.cropX,
        cropY: img.cropY,
        cropWidth: img.cropWidth,
        cropHeight: img.cropHeight,
      })),
    );
  } catch (renderErr) {
    console.error("[stripe.webhook] session path renderOrderImages failed", renderErr);
  }

  try {
    const forPdf = await prisma.orderImage.findMany({
      where: { orderId },
      orderBy: ORDER_IMAGE_LIST_ORDER_BY,
    });
    const grouped: Record<string, (typeof forPdf)[number][]> = {};
    for (const img of forPdf) {
      const k = img.shapeId;
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push(img);
    }
    const pdfUrls: string[] = [];
    for (const shapeId of Object.keys(grouped)) {
      const images = grouped[shapeId];
      if (!images?.length) continue;
      const pdfUrl = await generatePrintSheet(
        orderId,
        expandOrderImagesForPrintSheet(
          images.map((img) => ({
            id: img.id,
            renderedUrl: img.renderedUrl,
            copies: img.copies,
          })),
        ),
        shapeId,
      );
      pdfUrls.push(pdfUrl);
    }
    if (pdfUrls.length > 0) {
      console.info("[stripe.webhook] print sheets (session path)", { orderId, pdfUrls });
    }
  } catch (pdfErr) {
    console.error("[stripe.webhook] session path generatePrintSheet failed", pdfErr);
  }
}
