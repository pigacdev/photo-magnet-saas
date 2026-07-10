import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getEarlyAccessStatus } from "@/lib/earlyAccessDb";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await getEarlyAccessStatus();
    const user = await prisma.user.findFirst({
      where: { clerkId: userId, deletedAt: null },
      select: { id: true },
    });
    const organization = user
      ? await prisma.organization.findUnique({
          where: { id: user.id },
          select: { isEarlyAccess: true },
        })
      : null;

    return NextResponse.json({
      ...status,
      userIsEarlyAccess: organization?.isEarlyAccess ?? false,
    });
  } catch (err) {
    console.error("[GET /api/billing/early-access-status]", err);
    return NextResponse.json(
      { error: "Failed to load early access status" },
      { status: 500 },
    );
  }
}
