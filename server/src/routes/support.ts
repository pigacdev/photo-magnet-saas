import type { Request, Response } from "express";
import { Router } from "express";
import {
  buildSupportTicketHtml,
  buildSupportTicketSubject,
  isResendConfigured,
  sendSupportTicketEmail,
} from "../lib/email";
import { prisma } from "../lib/prisma";
import { findSellerOrderByReference } from "../lib/sellerOrderLookup";
import { normalizeOrderReference } from "../../../src/lib/orderReference";
import {
  assertHasSupport,
  SUPPORT_FEATURE_REQUIRED,
  PRO_FEATURE_REQUIRED_MESSAGE,
} from "../lib/saas";
import { planHasFeature } from "../lib/planCatalog";

export const supportRouter = Router();

const MIN_MESSAGE_LENGTH = 20;
const MAX_MESSAGE_LENGTH = 5000;

type SupportContextType = "GENERAL" | "EVENT" | "STOREFRONT" | "ORDER";

function parseContextType(raw: unknown): SupportContextType | null {
  if (raw === "GENERAL" || raw === "EVENT" || raw === "STOREFRONT" || raw === "ORDER") {
    return raw;
  }
  return null;
}

function parseOptionalId(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function resolveContextSummary(
  userId: string,
  contextType: SupportContextType,
  contextId: string | undefined,
  orderId: string | undefined,
): Promise<string> {
  if (contextType === "GENERAL") {
    return "General";
  }

  if (contextType === "EVENT") {
    const event = await prisma.event.findFirst({
      where: { id: contextId, userId, deletedAt: null },
      select: { name: true },
    });
    if (!event) throw new Error("EVENT_NOT_FOUND");
    return `Event: ${event.name}`;
  }

  if (contextType === "STOREFRONT") {
    const storefront = await prisma.storefront.findFirst({
      where: { id: contextId, userId, deletedAt: null },
      select: { name: true },
    });
    if (!storefront) throw new Error("STOREFRONT_NOT_FOUND");
    return `Storefront: ${storefront.name}`;
  }

  const order = await findSellerOrderByReference(userId, orderId ?? "");
  if (!order) throw new Error("ORDER_NOT_FOUND");
  const label = order.shortCode?.trim() || order.id.slice(0, 8).toUpperCase();
  return `Order: #${label}`;
}

supportRouter.post("/tickets", async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  let sellerPlan: "FREE" | "HOBBY" | "PRO";
  try {
    sellerPlan = await assertHasSupport(userId);
  } catch (err) {
    if (err instanceof Error && err.message === SUPPORT_FEATURE_REQUIRED) {
      res.status(403).json({ error: PRO_FEATURE_REQUIRED_MESSAGE });
      return;
    }
    if (err instanceof Error && err.message === "Organization not found") {
      res.status(404).json({ error: "Organization not found" });
      return;
    }
    throw err;
  }

  const contextType = parseContextType(req.body?.contextType);
  if (!contextType) {
    res.status(400).json({ error: "Invalid context type" });
    return;
  }

  const contextId = parseOptionalId(req.body?.contextId);
  const orderIdRaw = parseOptionalId(req.body?.orderId);
  const orderId = orderIdRaw ? normalizeOrderReference(orderIdRaw) : undefined;
  const messageRaw =
    typeof req.body?.message === "string" ? req.body.message.trim() : "";

  if (messageRaw.length < MIN_MESSAGE_LENGTH) {
    res
      .status(400)
      .json({ error: `Message must be at least ${MIN_MESSAGE_LENGTH} characters` });
    return;
  }
  if (messageRaw.length > MAX_MESSAGE_LENGTH) {
    res
      .status(400)
      .json({ error: `Message must be at most ${MAX_MESSAGE_LENGTH} characters` });
    return;
  }

  if (contextType === "GENERAL") {
    if (contextId || orderId) {
      res.status(400).json({ error: "General context cannot include event, storefront, or order" });
      return;
    }
  } else if (contextType === "EVENT" || contextType === "STOREFRONT") {
    if (!contextId) {
      res.status(400).json({ error: "Context selection is required" });
      return;
    }
    if (orderId) {
      res.status(400).json({ error: "Order id is not allowed for this context type" });
      return;
    }
  } else if (contextType === "ORDER") {
    if (!orderId) {
      res.status(400).json({ error: "Order id is required" });
      return;
    }
    if (contextId) {
      res.status(400).json({ error: "Context id is not allowed when order is selected" });
      return;
    }
  }

  let contextSummary: string;
  try {
    contextSummary = await resolveContextSummary(
      userId,
      contextType,
      contextId,
      orderId,
    );
  } catch (err) {
    if (err instanceof Error && err.message === "EVENT_NOT_FOUND") {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    if (err instanceof Error && err.message === "STOREFRONT_NOT_FOUND") {
      res.status(404).json({ error: "Storefront not found" });
      return;
    }
    if (err instanceof Error && err.message === "ORDER_NOT_FOUND") {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (err instanceof Error && err.message === "ORDER_AMBIGUOUS") {
      res.status(400).json({
        error:
          "That reference matches more than one order. Paste the full order id from the order page.",
      });
      return;
    }
    throw err;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    select: { email: true, name: true },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (!isResendConfigured()) {
    res.status(503).json({ error: "Email service is not configured" });
    return;
  }

  const priority = planHasFeature(sellerPlan, "priority_support");
  const subject = buildSupportTicketSubject(contextSummary, user.name, {
    priority,
  });
  const html = buildSupportTicketHtml({
    sellerName: user.name,
    sellerEmail: user.email,
    contextSummary,
    message: messageRaw,
    submittedAt: new Date(),
    priority,
  });

  await sendSupportTicketEmail({
    replyTo: user.email,
    subject,
    html,
  });

  res.json({ ok: true });
});
