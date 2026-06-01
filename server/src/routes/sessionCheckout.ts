/**
 * POST /api/session/checkout/validate — session-only checkout checks (no Order row, no file copy).
 */
import type { Request, Response } from "express";
import { Router } from "express";
import { sessionConfig } from "../config/session";
import { prepareOrderSessionCommit } from "../lib/orderSessionCheckoutCommit";
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
