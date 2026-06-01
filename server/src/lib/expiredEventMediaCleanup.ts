import { EVENT_MEDIA_RETENTION_HOURS_AFTER_END } from "../config/mediaRetention";
import { prisma } from "./prisma";
import {
  collectOrderImageMediaUrls,
  deleteOrderMediaBlob,
  isDeletableOrderMediaUrl,
  orderMediaBlobExists,
  pruneEmptyOrderMediaDirectories,
  type OrderMediaCleanupError,
} from "./orderMediaCleanup";

const MS_PER_HOUR = 60 * 60 * 1000;

const PAID_ORDER_STATUSES = new Set([
  "PAID",
  "IN_PRODUCTION",
  "SHIPPED",
  "COMPLETED",
]);

function isEventOrderFullyPaid(row: { status: string }): boolean {
  return PAID_ORDER_STATUSES.has(row.status);
}

export type CleanupExpiredEventMediaOptions = {
  dryRun?: boolean;
};

export type CleanupExpiredEventMediaResult = {
  dryRun: boolean;
  eventsScanned: number;
  eventsEligible: number;
  ordersScanned: number;
  orderImagesFound: number;
  filesFound: number;
  filesDeleted: number;
  filesAlreadyMissing: number;
  filesSkipped: number;
  orderImagesMarkedDeleted: number;
  foldersDeleted: number;
  errors: OrderMediaCleanupError[];
  retentionHours: number;
};

/**
 * Deletes order-image blobs for **ended events** past
 * `endDate + EVENT_MEDIA_RETENTION_HOURS_AFTER_END` (see mediaRetention config).
 * Only `Order` rows with `contextType === EVENT` and settled payment status.
 * Never deletes `Order` / `OrderImage` rows — sets `OrderImage.mediaDeletedAt` only after
 * all deletable URLs for that row were processed (same rules as `cleanupOrderMedia`).
 * Does not touch session images, storefront-only orders, or events still inside the retention window.
 */
export async function cleanupExpiredEventMedia(
  options: CleanupExpiredEventMediaOptions = {},
): Promise<CleanupExpiredEventMediaResult> {
  const dryRun = options.dryRun !== false;
  const retentionHours = EVENT_MEDIA_RETENTION_HOURS_AFTER_END;
  const retentionMs = retentionHours * MS_PER_HOUR;
  const now = new Date();
  const errors: OrderMediaCleanupError[] = [];

  const allEvents = await prisma.event.findMany({
    where: { deletedAt: null },
    select: { id: true, endDate: true },
  });
  const eventsScanned = allEvents.length;

  const eligibleEventIds = allEvents
    .filter((e) => e.endDate.getTime() + retentionMs < now.getTime())
    .map((e) => e.id)
    .sort();
  const eventsEligible = eligibleEventIds.length;

  const ordersRaw =
    eligibleEventIds.length === 0
      ? []
      : await prisma.order.findMany({
          where: {
            contextType: "EVENT",
            contextId: { in: eligibleEventIds },
            status: PAID_ORDER_STATUS,
          },
          select: {
            id: true,
            status: true,
          },
        });

  const paidOrders = ordersRaw.filter(isEventOrderFullyPaid);
  const ordersScanned = paidOrders.length;
  const orderIds = paidOrders.map((o) => o.id);

  const pendingImages =
    orderIds.length === 0
      ? []
      : await prisma.orderImage.findMany({
          where: {
            orderId: { in: orderIds },
            mediaDeletedAt: null,
          },
          select: {
            id: true,
            orderId: true,
            originalUrl: true,
            croppedUrl: true,
            renderedUrl: true,
          },
        });

  const orderImagesFound = pendingImages.length;

  let filesFound = 0;
  let filesSkipped = 0;

  for (const row of pendingImages) {
    const urls = collectOrderImageMediaUrls(row);
    filesFound += urls.length;
    for (const url of urls) {
      if (!isDeletableOrderMediaUrl(url)) {
        filesSkipped += 1;
      }
    }
  }

  console.info(
    `[event-media-cleanup] dryRun=${dryRun} eventsScanned=${eventsScanned} eventsEligible=${eventsEligible} orders=${ordersScanned} pendingImages=${orderImagesFound} urls=${filesFound}`,
  );

  if (dryRun) {
    for (const row of pendingImages) {
      for (const url of collectOrderImageMediaUrls(row)) {
        if (!isDeletableOrderMediaUrl(url)) {
          errors.push({
            message: "URL not under order-images storage (would skip)",
            orderId: row.orderId,
            orderImageId: row.id,
            url,
          });
        }
      }
    }

    return {
      dryRun: true,
      eventsScanned,
      eventsEligible,
      ordersScanned,
      orderImagesFound,
      filesFound,
      filesDeleted: 0,
      filesAlreadyMissing: 0,
      filesSkipped,
      orderImagesMarkedDeleted: 0,
      foldersDeleted: 0,
      errors,
      retentionHours,
    };
  }

  let filesDeleted = 0;
  let filesAlreadyMissing = 0;
  let orderImagesMarkedDeleted = 0;

  const deletedAt = now;

  for (const row of pendingImages) {
    const urls = collectOrderImageMediaUrls(row);

    const unsafe = urls.filter((u) => !isDeletableOrderMediaUrl(u));
    if (unsafe.length > 0) {
      for (const url of unsafe) {
        errors.push({
          message: "URL not under order-images storage (skipped)",
          orderId: row.orderId,
          orderImageId: row.id,
          url,
        });
      }
      continue;
    }

    let rowOk = true;
    for (const url of urls) {
      try {
        const exists = await orderMediaBlobExists(url);
        if (!exists) {
          filesAlreadyMissing += 1;
          continue;
        }
        try {
          await deleteOrderMediaBlob(url);
          filesDeleted += 1;
        } catch (delErr: unknown) {
          const code = (delErr as NodeJS.ErrnoException).code;
          if (code === "ENOENT") {
            filesAlreadyMissing += 1;
          } else {
            throw delErr;
          }
        }
      } catch (e: unknown) {
        rowOk = false;
        errors.push({
          message: e instanceof Error ? e.message : String(e),
          orderId: row.orderId,
          orderImageId: row.id,
          url,
        });
        console.warn(
          "[event-media-cleanup] delete failed",
          row.orderId,
          row.id,
          url,
          e,
        );
        break;
      }
    }

    if (rowOk) {
      await prisma.orderImage.update({
        where: { id: row.id },
        data: { mediaDeletedAt: deletedAt },
      });
      orderImagesMarkedDeleted += 1;
    }
  }

  const pruneOutcome = await pruneEmptyOrderMediaDirectories();
  const foldersDeleted = pruneOutcome.foldersDeleted;
  errors.push(...pruneOutcome.errors);

  console.info(
    `[event-media-cleanup] completed deleted=${filesDeleted} missing=${filesAlreadyMissing} marked=${orderImagesMarkedDeleted} folders=${foldersDeleted} errors=${errors.length}`,
  );

  return {
    dryRun: false,
    eventsScanned,
    eventsEligible,
    ordersScanned,
    orderImagesFound,
    filesFound,
    filesDeleted,
    filesAlreadyMissing,
    filesSkipped,
    orderImagesMarkedDeleted,
    foldersDeleted,
    errors,
    retentionHours,
  };
}
