import { Router } from "express";
import { prisma } from "../lib/prisma";
import { resolveAuthUser } from "../lib/clerkSession";
import { buildOrganizationUsage } from "../lib/organizationUsage";
import { syncOrganizationBillingFromClerk } from "../../../src/lib/clerkBillingSync";

export const authRouter = Router();

authRouter.get("/me", async (req, res) => {
  const authUser = await resolveAuthUser(req);

  if (!authUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.userId, deletedAt: null },
    select: { id: true, email: true, name: true, role: true, clerkId: true },
  });

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  try {
    await syncOrganizationBillingFromClerk(
      user.id,
      authUser.clerkUserId,
      authUser.sessionClaims,
    );
  } catch (err) {
    console.warn("[auth/me] Clerk billing sync failed", err);
  }

  const organization = await buildOrganizationUsage(user.id);

  res.json({
    user,
    organization,
  });
});
