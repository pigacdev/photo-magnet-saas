import { Router } from "express";
import { prisma } from "../lib/prisma";
import { resolveAuthUser } from "../lib/clerkSession";
import { buildOrganizationUsage } from "../lib/organizationUsage";
import { syncOrganizationBillingFromClerk } from "../../../src/lib/clerkBillingSync";
import { getEarlyAccessStatus } from "../../../src/lib/earlyAccessDb";
import { ensureSellerOrganization } from "../../../src/lib/clerkUserSync";
import { needsLegalReconsent } from "../lib/legalConstants";
import { isPlatformOwnerEmail } from "../lib/platformOwner";

export const authRouter = Router();

authRouter.get("/me", async (req, res) => {
  const authUser = await resolveAuthUser(req);

  if (!authUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      clerkId: true,
      legalAcceptedAt: true,
      legalVersion: true,
      erasureScheduledAt: true,
    },
  });

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  await ensureSellerOrganization(user.id);

  try {
    await syncOrganizationBillingFromClerk(
      user.id,
      authUser.clerkUserId,
      authUser.sessionClaims,
    );
  } catch (err) {
    console.warn("[auth/me] Clerk billing sync failed", err);
  }

  const [organization, earlyAccessBase, orgEarly] = await Promise.all([
    buildOrganizationUsage(user.id),
    getEarlyAccessStatus(),
    prisma.organization.findUnique({
      where: { id: user.id },
      select: { isEarlyAccess: true },
    }),
  ]);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      legalAcceptedAt: user.legalAcceptedAt?.toISOString() ?? null,
      legalVersion: user.legalVersion,
      needsLegalReconsent: needsLegalReconsent(
        user.legalAcceptedAt,
        user.legalVersion,
      ),
      erasureScheduledAt: user.erasureScheduledAt?.toISOString() ?? null,
    },
    organization,
    isPlatformOwner: isPlatformOwnerEmail(user.email),
    earlyAccess: {
      ...earlyAccessBase,
      userIsEarlyAccess: orgEarly?.isEarlyAccess ?? false,
    },
  });
});
