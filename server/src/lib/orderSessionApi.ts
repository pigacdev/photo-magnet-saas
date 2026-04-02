import type { OrderSession } from "../../../src/generated/prisma/client";
import type { Response } from "express";
import {
  getSessionCookieClearOptions,
  getSessionCookieSetOptions,
  sessionConfig,
} from "../config/session";

export type ApiOrderSession = {
  id: string;
  contextType: "event" | "storefront";
  contextId: string;
  status: "active" | "abandoned" | "converted";
  createdAt: string;
  startedAt: string;
  lastActiveAt: string;
  expiresAt: string;
};

export function serializeOrderSession(session: OrderSession): ApiOrderSession {
  return {
    id: session.id,
    contextType: session.contextType === "EVENT" ? "event" : "storefront",
    contextId: session.contextId,
    status: session.status.toLowerCase() as ApiOrderSession["status"],
    createdAt: session.createdAt.toISOString(),
    startedAt: session.startedAt.toISOString(),
    lastActiveAt: session.lastActiveAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
  };
}

export function setSessionCookie(res: Response, sessionId: string): void {
  res.cookie(
    sessionConfig.cookieName,
    sessionId,
    getSessionCookieSetOptions(),
  );
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(sessionConfig.cookieName, getSessionCookieClearOptions());
}
