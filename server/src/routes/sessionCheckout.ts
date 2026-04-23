/**
 * POST /api/session/checkout/validate — session-only checkout checks (no Order row, no file copy).
 * POST /api/session/checkout/customer — persist customer + shipping for session-first Stripe (webhook).
 */
import type { Request, Response } from "express";
import { Router } from "express";
import { Prisma } from "../../../src/generated/prisma/client";
import { sessionConfig } from "../config/session";
import { prepareOrderSessionCommit } from "../lib/orderSessionCheckoutCommit";
import { validateOrderCustomerBody } from "../lib/orderCustomerValidation";
import { prisma } from "../lib/prisma";
import { validateOrderSessionContext } from "../lib/sessionContextValidation";

export const sessionCheckoutRouter = Router();

function sendPrepareError(
  res: Response,
  err: { status: number; error: string; code?: string; message?: string },
) {
  if (err.status === 403 && err.code) {
    res.status(403).json({ code: err.code, message: err.message });
    return;
  }
  res.status(err.status).json(err.code ? { error: err.error, code: err.code } : { error: err.error });
}

sessionCheckoutRouter.post("/validate", async (req: Request, res: Response) => {
  const sessionId = req.cookies?.[sessionConfig.cookieName] as string | undefined;
  if (!sessionId) {
    res.status(400).json({ error: "Session required" });
    return;
  }

  const now = new Date();
  const prep = await prepareOrderSessionCommit(sessionId, req.body, now, undefined);

  if (prep.ok === "idempotent") {
    res.status(400).json({ error: "Order already created for this session" });
    return;
  }
  if (!prep.ok) {
    sendPrepareError(res, prep.err);
    return;
  }

  const { prepared } = prep;
  const { session, commitOrderQuantity, commitTotalPrice, sessionImages } = prepared;
  if (!session) {
    res.status(500).json({ error: "Session state missing" });
    return;
  }

  const contextOk = await validateOrderSessionContext(
    session.contextType,
    session.contextId,
  );
  if (!contextOk.ok) {
    if (contextOk.notFound) {
      res.status(404).json({ error: "Context not found" });
      return;
    }
    res.status(400).json({ error: contextOk.reason });
    return;
  }

  await prisma.orderSession.update({
    where: { id: String(sessionId) },
    data: {
      checkoutStage: "CUSTOMER_DETAILS",
      lastActiveAt: new Date(),
    },
  });

  res.json({
    ok: true,
    totalPrice: Number(commitTotalPrice),
    quantity: commitOrderQuantity ?? (sessionImages.length > 0 ? sessionImages.length : 0),
  });
});

/**
 * Save customer + shipping on OrderSession (same validation as order finalize) so Stripe
 * session checkout and post-payment finalization can read from the DB.
 */
sessionCheckoutRouter.post("/customer", async (req: Request, res: Response) => {
  const sessionId = req.cookies?.[sessionConfig.cookieName] as string | undefined;
  if (!sessionId) {
    res.status(400).json({ error: "Session required" });
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
    res.status(400).json({ error: "Order already exists for this session" });
    return;
  }
  if (sessionRow.status !== "ACTIVE" || sessionRow.expiresAt <= new Date()) {
    res.status(400).json({ error: "Session is not active" });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const customerBody = {
    customerName: body.customerName,
    customerPhone:
      (typeof body.phone === "string" ? body.phone : body.customerPhone) as unknown,
    shippingType: (body.shippingMethod ?? body.shippingType) as unknown,
    shippingAddress: body.shippingAddress,
  };

  const validated = validateOrderCustomerBody(sessionRow.contextType, customerBody);
  if ("error" in validated) {
    res.status(400).json({ error: validated.error });
    return;
  }

  const { data } = validated;
  const now = new Date();
  const contextOk = await validateOrderSessionContext(
    sessionRow.contextType,
    String(sessionRow.contextId),
  );
  if (!contextOk.ok) {
    if (contextOk.notFound) {
      res.status(404).json({ error: "Context not found" });
      return;
    }
    res.status(400).json({ error: contextOk.reason });
    return;
  }

  const shippingJson: Prisma.InputJsonValue | typeof Prisma.JsonNull =
    data.shippingAddress == null
      ? Prisma.JsonNull
      : (data.shippingAddress as Prisma.InputJsonValue);

  await prisma.orderSession.update({
    where: { id: String(sessionId) },
    data: {
      checkoutCustomerName: data.customerName,
      checkoutCustomerPhone: data.customerPhone,
      checkoutShippingType: data.shippingType,
      checkoutShippingAddress: shippingJson,
      checkoutStage: "CUSTOMER_DETAILS",
      lastActiveAt: now,
    },
  });

  res.json({ ok: true });
});
