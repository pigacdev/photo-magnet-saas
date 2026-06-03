import { prisma } from "./prisma";

export type EnsureSellerUserInput = {
  clerkId: string;
  email: string;
  name?: string | null;
};

export type SellerUserRecord = {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "STAFF";
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function defaultBillingPeriodEnd(from: Date = new Date()): Date {
  const end = new Date(from);
  end.setMonth(end.getMonth() + 1);
  return end;
}

export function displayNameFromClerk(
  name: string | null | undefined,
  firstName?: string | null,
  lastName?: string | null,
): string | null {
  if (name?.trim()) return name.trim();
  const parts = [firstName?.trim(), lastName?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Ensures a seller User (+ Organization) exists for a Clerk account.
 * Links legacy rows by email when clerkId is not yet set.
 */
export async function ensureSellerUser(
  input: EnsureSellerUserInput,
): Promise<SellerUserRecord> {
  const email = normalizeEmail(input.email);
  const name = input.name?.trim() || null;

  const byClerkId = await prisma.user.findFirst({
    where: { clerkId: input.clerkId, deletedAt: null },
    select: { id: true, email: true, name: true, role: true },
  });
  if (byClerkId) {
    if (name && byClerkId.name !== name) {
      return prisma.user.update({
        where: { id: byClerkId.id },
        data: { name },
        select: { id: true, email: true, name: true, role: true },
      });
    }
    return byClerkId;
  }

  const byEmail = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, email: true, name: true, role: true, clerkId: true },
  });

  if (byEmail) {
    return prisma.user.update({
      where: { id: byEmail.id },
      data: {
        clerkId: input.clerkId,
        name: name ?? byEmail.name,
      },
      select: { id: true, email: true, name: true, role: true },
    });
  }

  const periodEnd = defaultBillingPeriodEnd();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        clerkId: input.clerkId,
        email,
        name,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    await tx.organization.create({
      data: {
        id: user.id,
        currentPeriodEnd: periodEnd,
      },
    });

    return user;
  });
}
