import type { Request, Response, NextFunction } from "express";
import { isPlatformOwnerEmail } from "../lib/platformOwner";
import { resolveClerkPrimaryEmail, resolveClerkClient } from "../lib/clerkSession";
import { prisma } from "../lib/prisma";

async function resolveRequestOwnerEmail(req: Request): Promise<string | null> {
  const claimsEmail = req.user?.sessionClaims?.email;
  if (typeof claimsEmail === "string" && claimsEmail.trim()) {
    return claimsEmail.trim();
  }

  const client = resolveClerkClient();
  if (client && req.user?.clerkUserId) {
    try {
      const clerkUser = await client.users.getUser(req.user.clerkUserId);
      const clerkEmail = resolveClerkPrimaryEmail(clerkUser);
      if (clerkEmail) return clerkEmail;
    } catch {
      /* fall through to DB email */
    }
  }

  if (!req.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId, deletedAt: null },
    select: { email: true },
  });

  return user?.email ?? null;
}

export async function requirePlatformOwner(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const email = await resolveRequestOwnerEmail(req);
  if (!email || !isPlatformOwnerEmail(email)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  (req as Request & { platformOwnerEmail?: string }).platformOwnerEmail = email;

  next();
}
