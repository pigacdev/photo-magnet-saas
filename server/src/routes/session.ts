/**
 * Order session API
 * - POST /start: reuse (200) only if same context and session is a clean in-progress row
 *   (ACTIVE, not COMPLETED/PAYMENT_PENDING, no Stripe checkout id, not expired);
 *   otherwise clear cookie and create a new session (201).
 * - GET /: re-validates context (pricing + open/active + not deleted via sessionContextValidation)
 * - Cookie: httpOnly, sameSite lax, secure in production (see config/session.ts)
 */
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { sessionConfig } from "../config/session";
import {
  buildOrderSessionResponse,
  clearSessionCookie,
  serializeCatalogPricing,
  serializeCatalogShape,
  setSessionCookie,
} from "../lib/orderSessionApi";
import { applySessionSelectionPatch } from "../lib/sessionSelectionPatch";
import {
  validateEventOrderContext,
  validateOrderSessionContext,
  validateStorefrontOrderContext,
} from "../lib/sessionContextValidation";
import { runStaleSessionCheckoutCleanup } from "../lib/sessionCheckoutCleanup";
import { sessionImagesRouter } from "./sessionImages";
import { sessionCheckoutRouter } from "./sessionCheckout";

export const sessionRouter = Router();

sessionRouter.use("/images", sessionImagesRouter);
sessionRouter.use("/checkout", sessionCheckoutRouter);

/**
 * Reuse cookie session on /start only for an untouched cart: no paid/converting state,
 * no in-flight Stripe checkout, and TTL still valid. Otherwise storefront re-entry
 * must get a new OrderSession (see POST /start).
 */
function canReuseOrderSessionAtStart(
  row: {
    status: string;
    checkoutStage: string;
    stripeCheckoutSessionId: string | null;
    expiresAt: Date;
  },
  now: Date,
): boolean {
  if (row.status !== "ACTIVE") return false;
  if (row.checkoutStage === "COMPLETED" || row.checkoutStage === "PAYMENT_PENDING") {
    return false;
  }
  if (row.stripeCheckoutSessionId != null) return false;
  if (row.expiresAt <= now) return false;
  return true;
}

sessionRouter.post("/start", async (req, res) => {
  const { contextType, contextId } = req.body as {
    contextType?: string;
    contextId?: string;
  };

  if (
    contextType !== "event" &&
    contextType !== "storefront"
  ) {
    res.status(400).json({ error: "contextType must be \"event\" or \"storefront\"" });
    return;
  }

  if (!contextId || typeof contextId !== "string") {
    res.status(400).json({ error: "contextId is required" });
    return;
  }

  const now = new Date();
  await runStaleSessionCheckoutCleanup(now);
  await prisma.orderSession.updateMany({
    where: {
      status: "ACTIVE",
      expiresAt: { lte: now },
    },
    data: { status: "EXPIRED", checkoutStage: "ABANDONED" },
  });

  const wantType = contextType === "event" ? "EVENT" : "STOREFRONT";
  const cookieSessionId = req.cookies?.[sessionConfig.cookieName] as string | undefined;

  if (cookieSessionId) {
    const existing = await prisma.orderSession.findUnique({
      where: { id: cookieSessionId },
    });

    if (!existing) {
      clearSessionCookie(res);
    } else {
      const contextMatches =
        existing.contextType === wantType && existing.contextId === contextId;

      if (!contextMatches) {
        if (existing.status === "ACTIVE") {
          await prisma.orderSession.update({
            where: { id: existing.id },
            data: { status: "ABANDONED", checkoutStage: "ABANDONED" },
          });
        }
        clearSessionCookie(res);
      } else if (canReuseOrderSessionAtStart(existing, now)) {
        const validation =
          wantType === "EVENT"
            ? await validateEventOrderContext(contextId)
            : await validateStorefrontOrderContext(contextId);

        if (!validation.ok) {
          if (existing.status === "ACTIVE") {
            await prisma.orderSession.update({
              where: { id: existing.id },
              data: { status: "ABANDONED", checkoutStage: "ABANDONED" },
            });
          }
          clearSessionCookie(res);
          if (validation.notFound) {
            res.status(404).json({
              error:
                wantType === "EVENT" ? "Event not found" : "Storefront not found",
            });
            return;
          }
          res.status(400).json({ error: validation.reason });
          return;
        }

        setSessionCookie(res, existing.id);
        res.status(200).json({
          session: await buildOrderSessionResponse(existing),
        });
        return;
      } else {
        if (existing.status === "ACTIVE") {
          await prisma.orderSession.update({
            where: { id: existing.id },
            data: { status: "ABANDONED", checkoutStage: "ABANDONED" },
          });
        }
        clearSessionCookie(res);
      }
    }
  }

  if (contextType === "event") {
    const validation = await validateEventOrderContext(contextId);
    if (!validation.ok) {
      if (validation.notFound) {
        res.status(404).json({ error: "Event not found" });
        return;
      }
      res.status(400).json({ error: validation.reason });
      return;
    }

    const { event } = validation;
    const expiresAt = new Date(Date.now() + sessionConfig.ttlMs);
    const at = new Date();
    const session = await prisma.orderSession.create({
      data: {
        contextType: "EVENT",
        contextId: event.id,
        expiresAt,
        startedAt: at,
        lastActiveAt: at,
      },
    });

    setSessionCookie(res, session.id);
    res.status(201).json({
      session: await buildOrderSessionResponse(session),
    });
    return;
  }

  const validation = await validateStorefrontOrderContext(contextId);
  if (!validation.ok) {
    if (validation.notFound) {
      res.status(404).json({ error: "Storefront not found" });
      return;
    }
    res.status(400).json({ error: validation.reason });
    return;
  }

  const { storefront } = validation;
  const expiresAt = new Date(Date.now() + sessionConfig.ttlMs);
  const at = new Date();
  const session = await prisma.orderSession.create({
    data: {
      contextType: "STOREFRONT",
      contextId: storefront.id,
      expiresAt,
      startedAt: at,
      lastActiveAt: at,
    },
  });

  setSessionCookie(res, session.id);
  res.status(201).json({
    session: await buildOrderSessionResponse(session),
  });
});

/**
 * GET /api/session/current?orderSessionId=
 * For /order/success when Stripe redirects with orderSessionId (no cookie required).
 * Exposes order id + status for polling until webhook finalizes; does not return cart/PII.
 */
sessionRouter.get("/current", async (req, res) => {
  const raw = req.query.orderSessionId;
  const orderSessionId = typeof raw === "string" ? raw.trim() : "";
  if (!orderSessionId) {
    res.status(400).json({ error: "orderSessionId is required" });
    return;
  }

  const row = await prisma.orderSession.findUnique({
    where: { id: orderSessionId },
  });
  if (!row) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (!row.orderId) {
    res.json({
      orderId: null,
      orderStatus: null,
      contextType: row.contextType,
      contextId: row.contextId,
    });
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: row.orderId },
    select: { id: true, status: true },
  });
  if (!order) {
    res.json({
      orderId: null,
      orderStatus: null,
      contextType: row.contextType,
      contextId: row.contextId,
    });
    return;
  }

  res.json({
    orderId: order.id,
    orderStatus: order.status,
    contextType: row.contextType,
    contextId: row.contextId,
  });
});

sessionRouter.get("/", async (req, res) => {
  const sessionId = req.cookies?.[sessionConfig.cookieName] as string | undefined;

  if (!sessionId) {
    res.json({ session: null, shapes: [], pricing: [] });
    return;
  }

  const now = new Date();
  await runStaleSessionCheckoutCleanup(now);

  const session = await prisma.orderSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    clearSessionCookie(res);
    res.json({ session: null, shapes: [], pricing: [] });
    return;
  }

  if (session.status !== "ACTIVE" && session.status !== "CONVERTED") {
    clearSessionCookie(res);
    res.json({ session: null, shapes: [], pricing: [] });
    return;
  }

  if (session.status === "ACTIVE" && session.expiresAt <= now) {
    await prisma.orderSession.update({
      where: { id: session.id },
      data: { status: "EXPIRED", checkoutStage: "ABANDONED" },
    });
    clearSessionCookie(res);
    res.json({ session: null, shapes: [], pricing: [] });
    return;
  }

  const contextOk = await validateOrderSessionContext(
    session.contextType,
    session.contextId,
  );

  if (!contextOk.ok) {
    await prisma.orderSession.update({
      where: { id: session.id },
      data: { status: "ABANDONED", checkoutStage: "ABANDONED" },
    });
    clearSessionCookie(res);
    res.json({ session: null, shapes: [], pricing: [] });
    return;
  }

  const touched = await prisma.orderSession.update({
    where: { id: session.id },
    data: { lastActiveAt: new Date() },
  });

  const shapes = await prisma.allowedShape.findMany({
    where: {
      contextType: touched.contextType,
      contextId: touched.contextId,
    },
    orderBy: { displayOrder: "asc" },
  });

  const pricing = await prisma.pricing.findMany({
    where: {
      contextType: touched.contextType,
      contextId: touched.contextId,
      deletedAt: null,
    },
    orderBy: { displayOrder: "asc" },
  });

  res.json({
    session: await buildOrderSessionResponse(touched),
    shapes: shapes.map(serializeCatalogShape),
    pricing: pricing.map(serializeCatalogPricing),
  });
});

sessionRouter.patch("/", async (req, res) => {
  const sessionId = req.cookies?.[sessionConfig.cookieName] as string | undefined;

  if (!sessionId) {
    res.status(400).json({ error: "Session required" });
    return;
  }

  const session = await prisma.orderSession.findUnique({
    where: { id: sessionId },
  });

  const now = new Date();

  if (!session) {
    clearSessionCookie(res);
    res.status(400).json({ error: "Session not found" });
    return;
  }

  if (session.status !== "ACTIVE" || session.expiresAt <= now) {
    if (session.status === "ACTIVE") {
      await prisma.orderSession.update({
        where: { id: session.id },
        data: { status: "EXPIRED", checkoutStage: "ABANDONED" },
      });
    }
    clearSessionCookie(res);
    res.status(400).json({ error: "Session is not active" });
    return;
  }

  const contextOk = await validateOrderSessionContext(
    session.contextType,
    session.contextId,
  );

  if (!contextOk.ok) {
    await prisma.orderSession.update({
      where: { id: session.id },
      data: { status: "ABANDONED", checkoutStage: "ABANDONED" },
    });
    clearSessionCookie(res);
    res.status(400).json({ error: "Context is no longer valid" });
    return;
  }

  const result = await applySessionSelectionPatch(session, req.body);

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.json({
    session: await buildOrderSessionResponse(result.session),
  });
});

sessionRouter.delete("/", async (req, res) => {
  const sessionId = req.cookies?.[sessionConfig.cookieName] as string | undefined;

  if (sessionId) {
    const session = await prisma.orderSession.findUnique({
      where: { id: sessionId },
    });
    if (session?.status === "ACTIVE") {
      await prisma.orderSession.update({
        where: { id: sessionId },
        data: { status: "ABANDONED", checkoutStage: "ABANDONED" },
      });
    }
  }

  clearSessionCookie(res);
  res.json({ success: true });
});
