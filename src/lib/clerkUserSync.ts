import { prisma } from "./prisma";
import { defaultBillingPeriodEnd } from "./billingPeriod";

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

/** Ensures the 1:1 Organization row exists for a seller user id. */
export async function ensureSellerOrganization(userId: string): Promise<void> {
  const existing = await prisma.organization.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (existing) return;

  await prisma.organization.create({
    data: {
      id: userId,
      currentPeriodEnd: defaultBillingPeriodEnd(),
    },
  });
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
      const updated = await prisma.user.update({
        where: { id: byClerkId.id },
        data: { name },
        select: { id: true, email: true, name: true, role: true },
      });
      await ensureSellerOrganization(updated.id);
      return updated;
    }
    await ensureSellerOrganization(byClerkId.id);
    return byClerkId;
  }

  const byEmail = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, email: true, name: true, role: true, clerkId: true },
  });

  if (byEmail) {
    const linked = await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        clerkId: input.clerkId,
        name: name ?? byEmail.name,
      },
      select: { id: true, email: true, name: true, role: true },
    });
    await ensureSellerOrganization(linked.id);
    return linked;
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

/** Soft-delete seller when Clerk sends user.deleted. */
export async function softDeleteSellerByClerkId(clerkId: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { clerkId, deletedAt: null },
    select: { id: true },
  });
  if (!user) return;

  await prisma.user.update({
    where: { id: user.id },
    data: { deletedAt: new Date(), clerkId: null },
  });
}
