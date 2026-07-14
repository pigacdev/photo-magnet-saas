import { Prisma } from "../../../src/generated/prisma/client";
import { prisma } from "./prisma";
import { deleteAllCustomerImages } from "./orderImageDeletion";
import { logAuditEvent } from "./privacyAuditLog";

const ERASED_NAME = "[erased]";

export type EraseBuyerPiiResult = {
  ordersAnonymized: number;
  imagesDeleted: number;
  customerSoftDeleted: boolean;
};

/** Anonymize buyer PII on all orders for a customer and delete their images. */
export async function eraseBuyerPiiForCustomer(params: {
  organizationId: string;
  customerId: string;
  actorEmail?: string | null;
}): Promise<{ ok: true; result: EraseBuyerPiiResult } | { ok: false; status: number; error: string }> {
  const customer = await prisma.customer.findFirst({
    where: {
      id: params.customerId,
      organizationId: params.organizationId,
      deletedAt: null,
    },
  });
  if (!customer) {
    return { ok: false, status: 404, error: "Customer not found" };
  }

  const imageResult = await deleteAllCustomerImages({
    organizationId: params.organizationId,
    customerId: params.customerId,
    actorEmail: params.actorEmail,
  });

  const orders = await prisma.order.findMany({
    where: { customerId: params.customerId, organizationId: params.organizationId },
    select: { id: true },
  });

  const now = new Date();
  for (const order of orders) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        customerName: ERASED_NAME,
        customerEmail: null,
        customerPhone: null,
        shippingAddress: Prisma.DbNull,
        buyerPiiErasedAt: now,
      },
    });
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      name: ERASED_NAME,
      email: null,
      phone: null,
      deletedAt: now,
    },
  });

  await logAuditEvent({
    action: "buyer_pii_erased",
    actorEmail: params.actorEmail,
    organizationId: params.organizationId,
    targetType: "customer",
    targetId: params.customerId,
    metadata: {
      ordersAnonymized: orders.length,
      imagesDeleted: imageResult.deletedCount,
    },
  });

  return {
    ok: true,
    result: {
      ordersAnonymized: orders.length,
      imagesDeleted: imageResult.deletedCount,
      customerSoftDeleted: true,
    },
  };
}
