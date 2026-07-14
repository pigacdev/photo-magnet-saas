import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ensureSellerUser, ensureSellerOrganization } from "@/lib/clerkUserSync";
import { syncOrganizationBillingFromClerk } from "@/lib/clerkBillingSync";
import { prisma } from "@/lib/prisma";
import { buildOrganizationUsage } from "../../../../../server/src/lib/organizationUsage";
import { isPlatformOwnerEmail } from "../../../../../server/src/lib/platformOwner";
import { needsLegalReconsent } from "../../../../../server/src/lib/legalConstants";
import { getEarlyAccessStatus } from "@/lib/earlyAccessDb";

export const dynamic = "force-dynamic";

function resolveClerkEmail(
  clerkUser: NonNullable<Awaited<ReturnType<typeof currentUser>>>,
): string | null {
  const primary = clerkUser.primaryEmailAddress?.emailAddress;
  if (primary) return primary;

  const verified = clerkUser.emailAddresses.find(
    (entry) => entry.verification?.status === "verified",
  )?.emailAddress;
  if (verified) return verified;

  return clerkUser.emailAddresses[0]?.emailAddress ?? null;
}

export async function GET() {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const email = resolveClerkEmail(clerkUser);
  if (!email) {
    return NextResponse.json(
      { error: "No email address on your account" },
      { status: 400 },
    );
  }

  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    clerkUser.username ||
    null;

  try {
    const synced = await ensureSellerUser({
      clerkId: userId,
      email,
      name,
    });

    const user = await prisma.user.findUnique({
      where: { id: synced.id, deletedAt: null },
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
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    await ensureSellerOrganization(user.id);

    try {
      await syncOrganizationBillingFromClerk(
        user.id,
        userId,
        sessionClaims as Record<string, unknown>,
      );
    } catch (syncErr) {
      console.warn("[GET /api/auth/me] Clerk billing sync failed", syncErr);
    }

    const [organization, earlyAccessBase, orgEarly] = await Promise.all([
      buildOrganizationUsage(user.id),
      getEarlyAccessStatus(),
      prisma.organization.findUnique({
        where: { id: user.id },
        select: { isEarlyAccess: true },
      }),
    ]);

    return NextResponse.json({
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
      isPlatformOwner: isPlatformOwnerEmail(email),
      earlyAccess: {
        ...earlyAccessBase,
        userIsEarlyAccess: orgEarly?.isEarlyAccess ?? false,
      },
    });
  } catch (err) {
    console.error("[GET /api/auth/me]", err);
    return NextResponse.json(
      { error: "Failed to load account" },
      { status: 500 },
    );
  }
}
