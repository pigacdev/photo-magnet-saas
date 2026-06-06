/**
 * Legacy Stripe SaaS subscription webhook (pre–Clerk Billing).
 * New subscriptions use Clerk; this handler only downgrades orgs still on stripeSubscriptionId.
 */
import type { Request, Response } from "express";
import { Router } from "express";
import Stripe from "stripe";
import { Prisma } from "../../../src/generated/prisma/client";
import { prisma } from "../lib/prisma";
import { getStripeOrNull } from "../lib/stripe";
import { resolvePlanEntitlements } from "../lib/planCatalog";

export const stripeRouter = Router();

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

  if (!event?.type) {
    res.status(400).send("Invalid event");
    return;
  }

  try {
    try {
      await prisma.processedStripeEvent.create({
        data: { id: event.id },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        res.status(200).json({ received: true, duplicate: true });
        return;
      }
      throw e;
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const org = await prisma.organization.findFirst({
        where: { stripeSubscriptionId: sub.id },
      });

      if (!org) {
        res.status(200).json({ received: true });
        return;
      }

      const free = resolvePlanEntitlements("free_user");
      await prisma.organization.update({
        where: { id: org.id },
        data: {
          plan: free.plan,
          orderLimit: free.orderLimit,
          eventLimit: free.eventLimit,
          clerkPlanSlug: "free_user",
          stripeSubscriptionId: null,
          ordersThisMonth: 0,
          eventsCreatedThisMonth: 0,
        },
      });

      console.log("[stripe.webhook] legacy org downgraded to free", org.id);
    }

    res.status(200).json({ received: true });
  } catch (e) {
    console.error("[stripe.webhook] handler error", e);
    res.status(500).json({ error: "Webhook handler failed" });
  }
}
