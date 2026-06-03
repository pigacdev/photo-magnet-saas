import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ensureSellerUser } from "@/lib/clerkUserSync";
import { prisma } from "@/lib/prisma";
import { buildOrganizationUsage } from "../../../../../server/src/lib/organizationUsage";

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
  const { userId } = await auth();
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
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const organization = await buildOrganizationUsage(user.id);

    return NextResponse.json({ user, organization });
  } catch (err) {
    console.error("[GET /api/auth/me]", err);
    return NextResponse.json(
      { error: "Failed to load account" },
      { status: 500 },
    );
  }
}
