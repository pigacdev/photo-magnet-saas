/**
 * Order session API
 * - POST /start: abandons expired ACTIVE rows; reuse (200) only if cookie session matches
 *   incoming contextType + contextId exactly; otherwise abandons old row and creates (201)
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
import { sessionImagesRouter } from "./sessionImages";

export const sessionRouter = Router();

sessionRouter.use("/images", sessionImagesRouter);

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
  await prisma.orderSession.updateMany({
    where: {
      status: "ACTIVE",
      expiresAt: { lte: now },
    },
    data: { status: "ABANDONED" },
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
      // HARD GUARD: reuse only when the cookie session is for this exact context.
      // Any mismatch → do not reuse; abandon active row and create a new session below.
      const contextMatches =
        existing.contextType === wantType && existing.contextId === contextId;

      if (!contextMatches) {
        if (existing.status === "ACTIVE") {
          await prisma.orderSession.update({
            where: { id: existing.id },
            data: { status: "ABANDONED" },
          });
        }
        clearSessionCookie(res);
      } else if (existing.status === "ACTIVE" && existing.expiresAt > now) {
        const validation =
          wantType === "EVENT"
            ? await validateEventOrderContext(contextId)
            : await validateStorefrontOrderContext(contextId);

        if (!validation.ok) {
          await prisma.orderSession.update({
            where: { id: existing.id },
            data: { status: "ABANDONED" },
          });
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
            data: { status: "ABANDONED" },
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

sessionRouter.get("/", async (req, res) => {
  const sessionId = req.cookies?.[sessionConfig.cookieName] as string | undefined;

  if (!sessionId) {
    res.json({ session: null, shapes: [], pricing: [] });
    return;
  }

  const session = await prisma.orderSession.findUnique({
    where: { id: sessionId },
  });

  const now = new Date();

  if (!session) {
    clearSessionCookie(res);
    res.json({ session: null, shapes: [], pricing: [] });
    return;
  }

  if (session.status !== "ACTIVE" || session.expiresAt <= now) {
    if (session.status === "ACTIVE") {
      await prisma.orderSession.update({
        where: { id: session.id },
        data: { status: "ABANDONED" },
      });
    }
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
      data: { status: "ABANDONED" },
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
        data: { status: "ABANDONED" },
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
      data: { status: "ABANDONED" },
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
        data: { status: "ABANDONED" },
      });
    }
  }

  clearSessionCookie(res);
  res.json({ success: true });
});
