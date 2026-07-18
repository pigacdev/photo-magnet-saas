import { prisma } from "./prisma";
import { defaultBillingPeriodEnd } from "./billingPeriod";
import { logAuditEvent } from "../../server/src/lib/privacyAuditLog";
import { notifyPlatformNewUser } from "../../server/src/lib/platformSellerAlerts";
import {
  SellerAccountUnavailableError,
  sellerUserAccessibleWhere,
  sellerUserIsAccessible,
} from "./sellerUserAccess";

export type EnsureSellerUserInput = {
  clerkId: string;
  email: string;
  name?: string | null;
  legalAcceptedAt?: Date | null;
  legalVersion?: string | null;
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
    where: { clerkId: input.clerkId, AND: [sellerUserAccessibleWhere()] },
    select: { id: true, email: true, name: true, role: true },
  });
  if (byClerkId) {
    const legalPatch =
      input.legalAcceptedAt != null
        ? {
            legalAcceptedAt: input.legalAcceptedAt,
            legalVersion: input.legalVersion ?? null,
          }
        : {};
    if (name && byClerkId.name !== name) {
      const updated = await prisma.user.update({
        where: { id: byClerkId.id },
        data: { name, ...legalPatch },
        select: { id: true, email: true, name: true, role: true },
      });
      await ensureSellerOrganization(updated.id);
      return updated;
    }
    if (Object.keys(legalPatch).length > 0) {
      await prisma.user.update({
        where: { id: byClerkId.id },
        data: legalPatch,
      });
    }
    await ensureSellerOrganization(byClerkId.id);
    return byClerkId;
  }

  const byEmail = await prisma.user.findFirst({
    where: { email, AND: [sellerUserAccessibleWhere()] },
    select: { id: true, email: true, name: true, role: true, clerkId: true },
  });

  if (byEmail) {
    const linked = await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        clerkId: input.clerkId,
        name: name ?? byEmail.name,
        ...(input.legalAcceptedAt != null
          ? {
              legalAcceptedAt: input.legalAcceptedAt,
              legalVersion: input.legalVersion ?? null,
            }
          : {}),
      },
      select: { id: true, email: true, name: true, role: true },
    });
    await ensureSellerOrganization(linked.id);
    return linked;
  }

  const tombstone = await prisma.user.findFirst({
    where: { email },
    select: { deletedAt: true, erasureScheduledAt: true },
  });
  if (tombstone && !sellerUserIsAccessible(tombstone)) {
    throw new SellerAccountUnavailableError();
  }

  const periodEnd = defaultBillingPeriodEnd();

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        clerkId: input.clerkId,
        email,
        name,
        ...(input.legalAcceptedAt != null
          ? {
              legalAcceptedAt: input.legalAcceptedAt,
              legalVersion: input.legalVersion ?? null,
            }
          : {}),
      },
      select: { id: true, email: true, name: true, role: true },
    });

    await tx.organization.create({
      data: {
        id: created.id,
        currentPeriodEnd: periodEnd,
      },
    });

    return created;
  });

  await notifyPlatformNewUser({
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  return user;
}

/** Soft-delete seller when Clerk sends user.deleted. */
export async function softDeleteSellerByClerkId(clerkId: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { clerkId, deletedAt: null },
    select: { id: true },
  });
  if (!user) return;

  const graceDays = 30;
  const scheduledAt = new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000);
  const row = await prisma.user.update({
    where: { id: user.id },
    data: {
      deletedAt: new Date(),
      erasureScheduledAt: scheduledAt,
    },
    select: { id: true, email: true, erasureScheduledAt: true },
  });

  await logAuditEvent({
    action: "account_erasure_scheduled",
    actorEmail: "system:clerk",
    organizationId: row.id,
    targetType: "user",
    targetId: row.id,
    metadata: {
      reason: "clerk_webhook",
      email: row.email,
      erasureScheduledAt: row.erasureScheduledAt?.toISOString(),
    },
  });
}
