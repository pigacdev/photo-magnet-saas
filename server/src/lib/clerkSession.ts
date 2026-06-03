import {
  getClerkPublishableKeyFromEnv,
  getClerkSecretKeyFromEnv,
} from "../load-env";
import { createClerkClient } from "@clerk/backend";
import type { Request as ExpressRequest } from "express";
import { prisma } from "./prisma";
import { ensureSellerUser } from "../../../src/lib/clerkUserSync";

export interface AuthUser {
  userId: string;
  role: string;
}

let clerkClient: ReturnType<typeof createClerkClient> | null | undefined;

function getClerkSecretKey(): string | undefined {
  return getClerkSecretKeyFromEnv();
}

function getClerkPublishableKey(): string | undefined {
  return getClerkPublishableKeyFromEnv();
}

function getClerkClient(): ReturnType<typeof createClerkClient> | null {
  if (clerkClient !== undefined) return clerkClient;

  const secretKey = getClerkSecretKey();
  const publishableKey = getClerkPublishableKey();
  clerkClient =
    secretKey && publishableKey
      ? createClerkClient({ secretKey, publishableKey })
      : null;
  return clerkClient;
}

function getAuthorizedParties(): string[] {
  const parties = new Set<string>();
  for (const value of [
    process.env.APP_URL,
    process.env.CORS_ORIGIN,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]) {
    if (!value) continue;
    parties.add(value.replace(/\/$/, ""));
  }
  return [...parties];
}

function getAppOrigin(): string {
  return (
    process.env.APP_URL ||
    process.env.CORS_ORIGIN ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function expressToWebRequest(req: ExpressRequest): globalThis.Request {
  // Session cookies are issued for the Next.js app origin, not the Express port.
  const url = `${getAppOrigin()}${req.originalUrl}`;
  const headers = new Headers();

  const cookie = req.headers.cookie;
  if (cookie) headers.set("cookie", cookie);

  const authorization = req.headers.authorization;
  if (authorization) headers.set("authorization", authorization);

  return new globalThis.Request(url, { method: req.method, headers });
}

function resolveClerkPrimaryEmail(
  clerkUser: Awaited<
    ReturnType<NonNullable<ReturnType<typeof getClerkClient>>["users"]["getUser"]>
  >,
): string | null {
  const primary = clerkUser.emailAddresses.find(
    (entry) => entry.id === clerkUser.primaryEmailAddressId,
  )?.emailAddress;
  if (primary) return primary;

  const verified = clerkUser.emailAddresses.find(
    (entry) => entry.verification?.status === "verified",
  )?.emailAddress;
  if (verified) return verified;

  return clerkUser.emailAddresses[0]?.emailAddress ?? null;
}

export async function resolveAuthUser(
  req: ExpressRequest,
): Promise<AuthUser | null> {
  const clerkSecretKey = getClerkSecretKey();
  const publishableKey = getClerkPublishableKey();
  const client = getClerkClient();

  if (!clerkSecretKey || !publishableKey) {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        "[auth] Clerk keys missing on the API server. " +
          "Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to .env.local " +
          "(not .env.example), or run `npm run dev` so keyless keys exist in .clerk/.tmp/keyless.json.",
      );
    }
    return null;
  }

  if (!client) {
    return null;
  }

  try {
    const authOptions: {
      secretKey: string;
      publishableKey: string;
      authorizedParties?: string[];
    } = { secretKey: clerkSecretKey, publishableKey };

    const parties = getAuthorizedParties();
    if (parties.length > 0) {
      authOptions.authorizedParties = parties;
    }

    const requestState = await client.authenticateRequest(
      expressToWebRequest(req),
      authOptions,
    );

    if (!requestState.isAuthenticated) {
      return null;
    }

    const auth = requestState.toAuth();
    const clerkUserId = auth.userId;
    if (!clerkUserId) {
      return null;
    }

    let dbUser = await prisma.user.findFirst({
      where: { clerkId: clerkUserId, deletedAt: null },
      select: { id: true, role: true },
    });

    if (!dbUser) {
      const clerkUser = await client.users.getUser(clerkUserId);
      const primaryEmail = resolveClerkPrimaryEmail(clerkUser);

      if (!primaryEmail) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[auth] Clerk user has no email:", clerkUserId);
        }
        return null;
      }

      const name =
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
        clerkUser.username ||
        null;

      const synced = await ensureSellerUser({
        clerkId: clerkUserId,
        email: primaryEmail,
        name,
      });

      dbUser = { id: synced.id, role: synced.role };
    }

    return { userId: dbUser.id, role: dbUser.role };
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[auth] resolveAuthUser failed:", err);
    }
    return null;
  }
}

export async function requireAuthUser(
  req: ExpressRequest,
): Promise<AuthUser | null> {
  return resolveAuthUser(req);
}
