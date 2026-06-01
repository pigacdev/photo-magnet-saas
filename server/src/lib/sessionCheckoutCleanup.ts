import { prisma } from "./prisma";

/**
 * Mark stale in-progress sessions as EXPIRED + checkout ABANDONED.
 */
export async function runStaleSessionCheckoutCleanup(now: Date = new Date()) {
  return prisma.orderSession.updateMany({
    where: {
      status: "ACTIVE",
      checkoutStage: { in: ["BUILDING", "CUSTOMER_DETAILS"] },
      expiresAt: { lte: now },
    },
    data: {
      status: "EXPIRED",
      checkoutStage: "ABANDONED",
    },
  });
}
