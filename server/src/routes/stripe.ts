/**
 * Stripe SaaS subscription billing + webhook (no customer order payments).
 */
import type { Request, Response } from "express";
import { Router } from "express";
import Stripe from "stripe";
import { Prisma } from "../../../src/generated/prisma/client";
import { prisma } from "../lib/prisma";
import { getAppPublicUrl, getStripeOrNull } from "../lib/stripe";
import { authenticate } from "../middleware/auth";
import { syncOrganizationFromStripeSubscription } from "../lib/organizationUsage";
import { getStripeSubscriptionPeriod } from "../lib/stripeSubscriptionPeriod";

export const stripeRouter = Router();

stripeRouter.post("/create-subscription", authenticate, async (req: Request, res: Response) => {
  const stripe = getStripeOrNull();
  if (!stripe) {
    res.status(503).json({ error: "Stripe not configured" });
    return;
  }

  const priceId = process.env.STRIPE_PRICE_PRO?.trim();
  if (!priceId) {
    res.status(503).json({ error: "Subscription price not configured" });
    return;
  }

  const orgId = req.user!.userId;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
  });

  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  try {
    let customerId = org.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { orgId },
      });

      customerId = customer.id;

      await prisma.organization.update({
        where: { id: orgId },
        data: { stripeCustomerId: customerId },
      });
    }

    const appUrl = getAppPublicUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        orgId,
      },
      subscription_data: {
        metadata: { orgId },
      },
      success_url: `${appUrl}/dashboard/billing?success=true`,
      cancel_url: `${appUrl}/dashboard/billing?canceled=true`,
    });

    if (!session.url) {
      res.status(500).json({ error: "Could not start checkout" });
      return;
    }

    res.json({ url: session.url });
  } catch (e) {
    console.error("[stripe.create-subscription]", e);
    res.status(500).json({ error: "Could not start subscription checkout" });
  }
});

stripeRouter.post("/cancel-subscription", authenticate, async (req: Request, res: Response) => {
  const stripe = getStripeOrNull();
  if (!stripe) {
    res.status(503).json({ error: "Stripe not configured" });
    return;
  }

  const orgId = req.user!.userId;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
  });

  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  if (org.plan !== "PRO" || !org.stripeSubscriptionId) {
    res.status(400).json({ error: "No active subscription to cancel" });
    return;
  }

  try {
    const sub = await stripe.subscriptions.update(org.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    await syncOrganizationFromStripeSubscription(orgId, sub);

    const period = getStripeSubscriptionPeriod(sub);
    res.json({
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      currentPeriodEnd: period?.currentPeriodEnd.toISOString() ?? null,
    });
  } catch (e) {
    console.error("[stripe.cancel-subscription]", e);
    res.status(500).json({ error: "Could not cancel subscription" });
  }
});

stripeRouter.post(
  "/reactivate-subscription",
  authenticate,
  async (req: Request, res: Response) => {
    const stripe = getStripeOrNull();
    if (!stripe) {
      res.status(503).json({ error: "Stripe not configured" });
      return;
    }

    const orgId = req.user!.userId;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    if (org.plan !== "PRO" || !org.stripeSubscriptionId) {
      res.status(400).json({ error: "No subscription to reactivate" });
      return;
    }

    try {
      const sub = await stripe.subscriptions.update(org.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });

      await syncOrganizationFromStripeSubscription(orgId, sub);

      const period = getStripeSubscriptionPeriod(sub);
      res.json({
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        currentPeriodEnd: period?.currentPeriodEnd.toISOString() ?? null,
      });
    } catch (e) {
      console.error("[stripe.reactivate-subscription]", e);
      res.status(500).json({ error: "Could not reactivate subscription" });
    }
  },
);

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

  console.log("[stripe.webhook] event:", event.type);

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
        console.log("[stripe.webhook] duplicate event skipped:", event.id);
        res.status(200).json({ received: true, duplicate: true });
        return;
      }
      throw e;
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode !== "subscription") {
          console.warn(
            "[stripe.webhook] ignoring non-subscription checkout.session.completed",
            session.id,
          );
          res.status(200).json({ received: true });
          return;
        }

        const orgId = session.metadata?.orgId
          ? String(session.metadata.orgId)
          : "";
        if (!orgId) {
          res.status(200).json({ received: true });
          return;
        }

        const cust = session.customer;
        const customerId =
          typeof cust === "string" ? cust : cust && "id" in cust ? cust.id : null;
        const subField = session.subscription;
        const subscriptionId =
          typeof subField === "string"
            ? subField
            : subField && typeof subField === "object" && "id" in subField
              ? (subField as Stripe.Subscription).id
              : null;

        if (!customerId || !subscriptionId) {
          console.warn(
            "[stripe.webhook] subscription session missing customer or subscription",
            session.id,
          );
          res.status(200).json({ received: true });
          return;
        }

        try {
          await prisma.organization.update({
            where: { id: orgId },
            data: {
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
            },
          });
          console.log("[stripe.webhook] session.completed stored Stripe ids", {
            orgId,
          });
        } catch (err) {
          console.error("[stripe.webhook] session.completed failed", err);
        }

        res.status(200).json({ received: true });
        return;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerRaw = sub.customer;
        const customerId =
          typeof customerRaw === "string"
            ? customerRaw
            : customerRaw && typeof customerRaw === "object" && "id" in customerRaw
              ? customerRaw.id
              : null;
        const subscriptionId = sub.id;

        if (!customerId || !subscriptionId) {
          res.status(200).json({ received: true });
          return;
        }

        const org = await prisma.organization.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (!org) {
          res.status(200).json({ received: true });
          return;
        }

        if (org.stripeSubscriptionId !== subscriptionId) {
          await prisma.organization.update({
            where: { id: org.id },
            data: { stripeSubscriptionId: subscriptionId },
          });
          console.log("[stripe] subscription synced", org.id);
        }

        await syncOrganizationFromStripeSubscription(org.id, sub);

        res.status(200).json({ received: true });
        return;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerRaw = invoice.customer;
        const customerId =
          typeof customerRaw === "string"
            ? customerRaw
            : customerRaw?.id;

        if (!customerId) {
          res.status(200).json({ received: true });
          return;
        }

        const org = await prisma.organization.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (!org) {
          res.status(200).json({ received: true });
          return;
        }

        if (org.plan !== "PRO") {
          await prisma.organization.update({
            where: { id: org.id },
            data: {
              plan: "PRO",
            },
          });
          console.log("[stripe] org upgraded to PRO", org.id);
        }

        if (org.stripeSubscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
            await syncOrganizationFromStripeSubscription(org.id, sub);
          } catch (err) {
            console.warn("[stripe] invoice.paid could not sync subscription period", err);
          }
        }

        res.status(200).json({ received: true });
        return;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        const org = await prisma.organization.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });

        if (!org) {
          res.status(200).json({ received: true });
          return;
        }

        await prisma.organization.update({
          where: { id: org.id },
          data: {
            plan: "FREE",
            stripeSubscriptionId: null,
            ordersThisMonth: 0,
          },
        });

        console.log("[stripe] org downgraded to FREE", org.id);

        res.status(200).json({ received: true });
        return;
      }
      default:
        res.status(200).end();
        return;
    }
  } catch (e) {
    console.error("[stripe.webhook] handler error", e);
    res.status(500).json({ error: "Webhook handler failed" });
  }
}
