import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import {
  EARLY_ACCESS_SEAT_LIMIT,
  earlyAccessExpiresAt,
  isEarlyAccessEligiblePlanSlug,
} from "./earlyAccess";
import { setEarlyAccessPlansClosed } from "./clerkBillingAdmin";

export type EarlyAccessStatus = {
  isOpen: boolean;
  seatsTaken: number;
  seatLimit: number;
  seatsRemaining: number;
};

export async function getEarlyAccessStatus(): Promise<EarlyAccessStatus> {
  const counter = await prisma.earlyAccessCounter.findUnique({
    where: { id: 1 },
    select: { seatsTaken: true, plansFlippedAt: true },
  });

  const seatsTaken = counter?.seatsTaken ?? 0;
  const isOpen = !counter?.plansFlippedAt && seatsTaken < EARLY_ACCESS_SEAT_LIMIT;

  return {
    isOpen,
    seatsTaken,
    seatLimit: EARLY_ACCESS_SEAT_LIMIT,
    seatsRemaining: Math.max(0, EARLY_ACCESS_SEAT_LIMIT - seatsTaken),
  };
}

type IncrementSeatResult = {
  seatsTaken: number;
  qualifiesForEarlyAccess: boolean;
};

/**
 * Atomically increment seat counter. Returns whether this signup qualifies
 * for the 60-day early-access window (seatsTaken <= limit at increment time).
 */
export async function incrementEarlyAccessSeat(): Promise<IncrementSeatResult> {
  const rows = await prisma.$queryRaw<{ seatsTaken: number }[]>`
    UPDATE "EarlyAccessCounter"
    SET "seatsTaken" = "seatsTaken" + 1
    WHERE id = 1
    RETURNING "seatsTaken"
  `;

  const seatsTaken = rows[0]?.seatsTaken ?? 0;
  return {
    seatsTaken,
    qualifiesForEarlyAccess: seatsTaken <= EARLY_ACCESS_SEAT_LIMIT,
  };
}

export async function maybeFlipEarlyAccessPlans(
  seatsTaken: number,
): Promise<void> {
  if (seatsTaken < EARLY_ACCESS_SEAT_LIMIT) return;

  const counter = await prisma.earlyAccessCounter.findUnique({
    where: { id: 1 },
    select: { plansFlippedAt: true },
  });
  if (counter?.plansFlippedAt) return;

  const ok = await setEarlyAccessPlansClosed();
  if (ok) {
    await prisma.earlyAccessCounter.update({
      where: { id: 1 },
      data: { plansFlippedAt: new Date() },
    });
  }
}

export type EarlyAccessSignupInput = {
  orgId: string;
  clerkPlanSlug: string;
  clerkSubscriptionId: string | null;
  /** Clerk trial period_end; falls back to now + 60 days. */
  trialEndsAt?: Date | null;
};

/**
 * Handle early-access seat counting and org flags on subscription.created
 * for hobby/pro free-trial signups while seats remain.
 */
export async function applyEarlyAccessSignup(
  input: EarlyAccessSignupInput,
): Promise<void> {
  const { orgId, clerkPlanSlug, clerkSubscriptionId, trialEndsAt } = input;
  if (!isEarlyAccessEligiblePlanSlug(clerkPlanSlug)) return;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      isEarlyAccess: true,
      clerkSubscriptionId: true,
    },
  });

  if (org?.isEarlyAccess) return;

  const { seatsTaken, qualifiesForEarlyAccess } =
    await incrementEarlyAccessSeat();

  const earlyAccessData: Prisma.OrganizationUpdateInput = {};
  if (qualifiesForEarlyAccess) {
    earlyAccessData.isEarlyAccess = true;
    earlyAccessData.earlyAccessExpiresAt =
      trialEndsAt ?? earlyAccessExpiresAt();
    earlyAccessData.grantLifetimeDiscount = false;
  }

  if (Object.keys(earlyAccessData).length > 0) {
    await prisma.organization.update({
      where: { id: orgId },
      data: earlyAccessData,
    });
  }

  await maybeFlipEarlyAccessPlans(seatsTaken);
}
