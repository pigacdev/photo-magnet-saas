/**
 * Stripe Checkout (storefront) + webhook (payment confirmation).
 */
import type { Request, Response } from "express";
import { Router } from "express";
import Stripe from "stripe";
import { prisma } from "../lib/prisma";
import { ORDER_IMAGE_LIST_ORDER_BY } from "../lib/magnetImageOrderBy";
import { renderOrderImages } from "../lib/renderOrderImages";
import { getAppPublicUrl, getStripeOrNull } from "../lib/stripe";
import { sessionConfig } from "../config/session";

export const stripeRouter = Router();

stripeRouter.post("/checkout-session", async (req: Request, res: Response) => {
  const s = getStripeOrNull();
  if (!s) {
    res.status(503).json({ error: "Payment system not configured" });
    return;
  }

  const orderIdRaw = (req.body as { orderId?: unknown })?.orderId;
  if (typeof orderIdRaw !== "string" || orderIdRaw.length === 0) {
    res.status(400).json({ error: "orderId required" });
    return;
  }
  const orderId = String(orderIdRaw);

  const cookieSessionId = req.cookies?.[sessionConfig.cookieName] as string | undefined;
  if (!cookieSessionId) {
    res.status(401).json({ error: "Session required" });
    return;
  }

  const orderSession = await prisma.orderSession.findUnique({
    where: { id: String(cookieSessionId) },
  });
  if (!orderSession?.orderId || orderSession.orderId !== orderId) {
    res.status(403).json({ error: "Invalid order for this session" });
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { _count: { select: { orderImages: true } } },
  });

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (order.contextType !== "STOREFRONT") {
    res.status(400).json({ error: "Online payment is only for storefront orders" });
    return;
  }
  if (order.status === "PAID") {
    res.status(400).json({ error: "Order is already paid" });
    return;
  }
  if (order.status !== "PENDING_PAYMENT") {
    res.status(400).json({ error: "Order is not awaiting payment" });
    return;
  }

  const n = order._count.orderImages;
  const total = Number(order.totalPrice);
  const unitAmount = Math.round(total * 100);
  if (!Number.isFinite(unitAmount) || unitAmount < 1) {
    res.status(400).json({ error: "Invalid order total" });
    return;
  }

  const appUrl = getAppPublicUrl();
  const currency = order.currency.trim().toLowerCase();

  try {
    // One Checkout Session per order: reuse open session instead of creating duplicates on double-clicks.
    if (order.stripeCheckoutSessionId) {
      try {
        const existing = await s.checkout.sessions.retrieve(
          order.stripeCheckoutSessionId,
        );
        if (existing.status === "open" && existing.url) {
          console.info("[stripe.checkout-session] reuse existing session", {
            orderId: order.id,
            stripeSessionId: existing.id,
          });
          res.json({ url: existing.url });
          return;
        }
        if (existing.status === "complete") {
          res.status(409).json({
            error:
              "This checkout was already completed. If payment succeeded, your order will update shortly.",
          });
          return;
        }
        // expired — create a new session and replace stripeCheckoutSessionId below
      } catch (retrieveErr) {
        console.warn(
          "[stripe.checkout-session] could not retrieve stored session; creating new",
          { orderId: order.id, err: retrieveErr },
        );
      }
    }

    const session = await s.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
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
        orderId: order.id,
      },
      success_url: `${appUrl}/order/success?orderId=${encodeURIComponent(order.id)}`,
      cancel_url: `${appUrl}/order/payment?orderId=${encodeURIComponent(order.id)}`,
    });

    if (!session.url) {
      res.status(500).json({ error: "Could not start checkout" });
      return;
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { stripeCheckoutSessionId: session.id },
    });

    res.json({ url: session.url });
  } catch (e) {
    console.error("[stripe.checkout-session]", e);
    res.status(500).json({ error: "Could not start checkout" });
  }
});

export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const stripe = getStripeOrNull();
  if (!stripe) {
    res.status(500).send("Stripe not configured");
    return;
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    res.status(503).send("Webhook not configured");
    return;
  }

  const sig = req.headers["stripe-signature"];
  if (typeof sig !== "string") {
    res.status(400).send("Missing stripe-signature");
    return;
  }

  const rawBody = req.body;
  if (!Buffer.isBuffer(rawBody)) {
    res.status(400).send("Expected raw body");
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe.webhook] signature verification failed", err);
    res.status(400).send("Webhook signature verification failed");
    return;
  }

  // Only handle events we act on; acknowledge everything else with 200 so Stripe does not retry.
  if (event.type !== "checkout.session.completed") {
    res.status(200).end();
    return;
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const orderId =
    session.metadata?.orderId != null ? String(session.metadata.orderId) : "";

  if (!orderId) {
    console.error("[stripe.webhook] missing metadata.orderId", session.id);
    res.status(200).json({ received: true });
    return;
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      console.error("[stripe.webhook] order not found", orderId);
      res.status(200).json({ received: true });
      return;
    }
    if (order.status === "PAID") {
      res.json({ received: true });
      return;
    }
    if (order.status !== "PENDING_PAYMENT") {
      console.warn(
        "[stripe.webhook] unexpected order status",
        order.status,
        orderId,
      );
      res.status(200).json({ received: true });
      return;
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "PAID",
        stripeCheckoutSessionId: session.id,
      },
    });

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
      console.error("[stripe.webhook] renderOrderImages failed", renderErr);
    }

    console.info("[stripe.webhook] order paid", {
      orderId,
      stripeSessionId: session.id,
    });
    res.json({ received: true });
  } catch (e) {
    console.error("[stripe.webhook] handler error", e);
    res.status(500).json({ error: "Webhook handler failed" });
  }
}
