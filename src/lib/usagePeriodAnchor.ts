import { prisma } from "./prisma";
import {
  defaultBillingPeriodEnd,
  isCorruptedUsagePeriod,
  resolveUsagePeriodWindow,
} from "./billingPeriod";
import { isValidBillingPeriodDate } from "./clerkBillingPeriod";

/**
 * Set or repair the app-managed monthly usage window. Uses Clerk subscription
 * `period_start` as the anniversary anchor when provided.
 */
export async function maybeApplyUsagePeriodAnchor(
  orgId: string,
  clerkPeriodStart?: Date,
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { currentPeriodStart: true, currentPeriodEnd: true },
  });

  if (!org) return;

  const invalidPeriod =
    !Number.isFinite(org.currentPeriodStart.getTime()) ||
    !Number.isFinite(org.currentPeriodEnd.getTime());
  const corrupted =
    !invalidPeriod &&
    isCorruptedUsagePeriod(org.currentPeriodStart, org.currentPeriodEnd);

  if (!invalidPeriod && !corrupted) return;

  const now = new Date();
  const anchor =
    clerkPeriodStart && isValidBillingPeriodDate(clerkPeriodStart)
      ? clerkPeriodStart
      : now;
  const window = resolveUsagePeriodWindow(
    anchor,
    defaultBillingPeriodEnd(anchor),
    now,
  );

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      currentPeriodStart: window.currentPeriodStart,
      currentPeriodEnd: window.currentPeriodEnd,
      ...(invalidPeriod
        ? { ordersThisMonth: 0, eventsCreatedThisMonth: 0 }
        : {}),
    },
  });
}
