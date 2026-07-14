import { prisma } from "./prisma";
import {
  collectOrderImageMediaUrls,
  deleteOrderMediaBlob,
  isDeletableOrderMediaUrl,
} from "./orderMediaCleanup";
import { logAuditEvent } from "./privacyAuditLog";

export type DeleteOrderImageResult = {
  deletedCount: number;
  errors: string[];
};

async function deleteOrderImageBlobs(row: {
  originalUrl: string;
  croppedUrl: string | null;
  renderedUrl: string | null;
}): Promise<{ deleted: number; errors: string[] }> {
  const urls = collectOrderImageMediaUrls(row);
  let deleted = 0;
  const errors: string[] = [];
  for (const url of urls) {
    if (!isDeletableOrderMediaUrl(url)) continue;
    try {
      await deleteOrderMediaBlob(url);
      deleted += 1;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { deleted, errors };
}

/** Mark one order image as GDPR-deleted (tombstone row). */
export async function deleteSingleOrderImage(params: {
  organizationId: string;
  orderId: string;
  imageId: string;
  actorEmail?: string | null;
  reason?: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const image = await prisma.orderImage.findFirst({
    where: {
      id: params.imageId,
      orderId: params.orderId,
      deletedAt: null,
      order: { organizationId: params.organizationId },
    },
  });
  if (!image) {
    return { ok: false, status: 404, error: "Image not found" };
  }

  await deleteOrderImageBlobs(image);
  await prisma.orderImage.update({
    where: { id: image.id },
    data: {
      deletedAt: new Date(),
      deletedReason: params.reason ?? "seller_gdpr_request",
      mediaDeletedAt: new Date(),
    },
  });

  await logAuditEvent({
    action: "order_image_deleted",
    actorEmail: params.actorEmail,
    organizationId: params.organizationId,
    targetType: "order_image",
    targetId: image.id,
    metadata: { orderId: params.orderId },
  });

  return { ok: true };
}

/** Delete all non-deleted images on an order. */
export async function deleteAllOrderImages(params: {
  organizationId: string;
  orderId: string;
  actorEmail?: string | null;
  reason?: string;
  suppressAuditLog?: boolean;
}): Promise<DeleteOrderImageResult> {
  const images = await prisma.orderImage.findMany({
    where: {
      orderId: params.orderId,
      deletedAt: null,
      order: { organizationId: params.organizationId },
    },
  });

  let deletedCount = 0;
  const errors: string[] = [];
  for (const img of images) {
    const blob = await deleteOrderImageBlobs(img);
    errors.push(...blob.errors);
    await prisma.orderImage.update({
      where: { id: img.id },
      data: {
        deletedAt: new Date(),
        deletedReason: params.reason ?? "seller_gdpr_request",
        mediaDeletedAt: new Date(),
      },
    });
    deletedCount += 1;
  }

  if (!params.suppressAuditLog) {
    await logAuditEvent({
      action: "order_images_deleted",
      actorEmail: params.actorEmail,
      organizationId: params.organizationId,
      targetType: "order",
      targetId: params.orderId,
      metadata: { count: deletedCount },
    });
  }

  return { deletedCount, errors };
}

/** Delete all images across a customer's orders. */
export async function deleteAllCustomerImages(params: {
  organizationId: string;
  customerId: string;
  actorEmail?: string | null;
}): Promise<DeleteOrderImageResult & { orderCount: number }> {
  const orders = await prisma.order.findMany({
    where: { customerId: params.customerId, organizationId: params.organizationId },
    select: { id: true },
  });

  let deletedCount = 0;
  const errors: string[] = [];
  for (const order of orders) {
    const result = await deleteAllOrderImages({
      organizationId: params.organizationId,
      orderId: order.id,
      actorEmail: params.actorEmail,
      reason: "customer_gdpr_request",
      suppressAuditLog: true,
    });
    deletedCount += result.deletedCount;
    errors.push(...result.errors);
  }

  await logAuditEvent({
    action: "customer_images_deleted",
    actorEmail: params.actorEmail,
    organizationId: params.organizationId,
    targetType: "customer",
    targetId: params.customerId,
    metadata: { imageCount: deletedCount, orderCount: orders.length },
  });

  return { deletedCount, errors, orderCount: orders.length };
}
