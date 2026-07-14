import { Prisma } from "../../../src/generated/prisma/client";
import { prisma } from "./prisma";
import { ORDER_PII_RETENTION_DAYS } from "./legalConstants";
import { logAuditEvent } from "./privacyAuditLog";

const ERASED_NAME = "[erased]";

export type PiiRetentionResult = {
  ordersAnonymized: number;
  customersPurged: number;
};

/** Anonymize old order snapshot PII and hard-delete soft-deleted customers. */
export async function runOrderPiiRetention(options?: {
  dryRun?: boolean;
}): Promise<PiiRetentionResult> {
  const dryRun = options?.dryRun === true;
  const cutoff = new Date(
    Date.now() - ORDER_PII_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { lt: cutoff },
      buyerPiiErasedAt: null,
      OR: [
        { customerEmail: { not: null } },
        { customerPhone: { not: null } },
        { customerName: { not: ERASED_NAME } },
      ],
    },
    select: { id: true },
  });

  let ordersAnonymized = 0;
  if (!dryRun) {
    for (const order of orders) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          customerName: ERASED_NAME,
          customerEmail: null,
          customerPhone: null,
          shippingAddress: Prisma.DbNull,
          buyerPiiErasedAt: new Date(),
        },
      });
      ordersAnonymized += 1;
    }
  } else {
    ordersAnonymized = orders.length;
  }

  const softDeleted = await prisma.customer.findMany({
    where: {
      deletedAt: { not: null, lt: cutoff },
    },
    select: { id: true },
  });

  let customersPurged = 0;
  if (!dryRun && softDeleted.length > 0) {
    const result = await prisma.customer.deleteMany({
      where: { id: { in: softDeleted.map((c) => c.id) } },
    });
    customersPurged = result.count;
  } else {
    customersPurged = softDeleted.length;
  }

  if (!dryRun && (ordersAnonymized > 0 || customersPurged > 0)) {
    await logAuditEvent({
      action: "pii_retention_run",
      metadata: { ordersAnonymized, customersPurged, cutoff: cutoff.toISOString() },
    });
  }

  return { ordersAnonymized, customersPurged };
}
