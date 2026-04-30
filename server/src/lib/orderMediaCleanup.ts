import fs from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { ORDER_MEDIA_RETENTION_DAYS } from "../config/mediaRetention";
import { s3Config } from "../config/s3";
import { prisma } from "./prisma";
import {
  extractS3KeyFromPublicUrl,
  getS3Client,
} from "./sessionImageStorage";

export type CleanupOrderMediaOptions = {
  dryRun?: boolean;
};

export type OrderMediaCleanupError = {
  message: string;
  orderId?: string;
  orderImageId?: string;
  url?: string;
};

export type FilesFoundByOrderEntry = { orderId: string; count: number };

export type CleanupOrderMediaResult = {
  dryRun: boolean;
  ordersScanned: number;
  ordersEligible: number;
  orderImagesFound: number;
  /** Distinct URL slots across pending rows (after per-row dedupe). */
  filesFound: number;
  filesDeleted: number;
  filesAlreadyMissing: number;
  /** URLs outside allowed storage paths (skipped). */
  filesSkipped: number;
  orderImagesMarkedDeleted: number;
  foldersDeleted: number;
  errors: OrderMediaCleanupError[];
  retentionDays: number;
  eligibleOrderIds?: string[];
  filesFoundByOrder?: FilesFoundByOrderEntry[];
};

/**
 * Fully settled orders only: `status` and `paymentStatus` both the string `PAID`.
 * `paymentStatus` is not filtered in SQL here: the column is stored as plain text while
 * Prisma would otherwise compare against the native Postgres `PaymentStatus` enum and error
 * (`character varying = "PaymentStatus"`). We filter in code with string equality instead.
 */
const PAID_ELIGIBLE_STATUS = "PAID";
const PAID_ELIGIBLE_PAYMENT_STATUS = "PAID";

function isFullyPaidEligibleOrder(row: {
  status: string;
  paymentStatus: string;
}): boolean {
  return (
    row.status === PAID_ELIGIBLE_STATUS &&
    row.paymentStatus === PAID_ELIGIBLE_PAYMENT_STATUS
  );
}

function isS3HeadNotFound(e: unknown): boolean {
  const err = e as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  if (err.$metadata?.httpStatusCode === 404) return true;
  const n = err.name ?? err.Code ?? "";
  return n === "NotFound" || n === "NoSuchKey" || n === "NotFoundException";
}

/**
 * Local `/uploads/...` or S3 keys under `order-images/` or `order-images-rendered/` only.
 */
export function isDeletableOrderMediaUrl(originalUrl: string): boolean {
  if (s3Config.bucket && originalUrl.startsWith("http")) {
    const key = extractS3KeyFromPublicUrl(originalUrl);
    return (
      key != null &&
      (key.startsWith("order-images/") || key.startsWith("order-images-rendered/"))
    );
  }

  try {
    const pathname = originalUrl.startsWith("http")
      ? new URL(originalUrl).pathname
      : originalUrl;
    const relativeFromCwd = pathname.replace(/^\/+/, "").replace(/\\/g, "/");
    const roots = [
      path.resolve(process.cwd(), "uploads", "order-images"),
      path.resolve(process.cwd(), "uploads", "order-images-rendered"),
    ];
    if (
      !relativeFromCwd.startsWith("uploads/order-images/") &&
      !relativeFromCwd.startsWith("uploads/order-images-rendered/")
    ) {
      return false;
    }
    const abs = path.resolve(process.cwd(), relativeFromCwd);
    for (const root of roots) {
      const rel = path.relative(root, abs);
      if (rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function orderMediaBlobExists(originalUrl: string): Promise<boolean> {
  if (!isDeletableOrderMediaUrl(originalUrl)) return false;

  if (s3Config.bucket && originalUrl.startsWith("http")) {
    const key = extractS3KeyFromPublicUrl(originalUrl);
    if (!key) return false;
    const client = getS3Client();
    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: s3Config.bucket,
          Key: key,
        }),
      );
      return true;
    } catch (e: unknown) {
      if (isS3HeadNotFound(e)) return false;
      throw e;
    }
  }

  const pathname = originalUrl.startsWith("http")
    ? new URL(originalUrl).pathname
    : originalUrl;
  const withoutLeading = pathname.replace(/^\/+/, "");
  const diskPath = path.join(process.cwd(), withoutLeading);
  try {
    const st = await fs.stat(diskPath);
    return st.isFile();
  } catch (e: unknown) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return false;
    throw e;
  }
}

async function deleteOrderMediaBlob(originalUrl: string): Promise<void> {
  if (!isDeletableOrderMediaUrl(originalUrl)) {
    throw new Error("Refusing to delete: not an order-media URL");
  }

  if (s3Config.bucket && originalUrl.startsWith("http")) {
    const key = extractS3KeyFromPublicUrl(originalUrl);
    if (!key) throw new Error("Could not resolve S3 key for delete");
    await getS3Client().send(
      new DeleteObjectCommand({
        Bucket: s3Config.bucket,
        Key: key,
      }),
    );
    return;
  }

  const pathname = originalUrl.startsWith("http")
    ? new URL(originalUrl).pathname
    : originalUrl;
  const withoutLeading = pathname.replace(/^\/+/, "");
  const diskPath = path.join(process.cwd(), withoutLeading);
  await fs.unlink(diskPath);
}

async function pruneEmptyDirsUnderRoot(absRoot: string): Promise<number> {
  let removed = 0;

  async function walk(d: string): Promise<void> {
    let ents;
    try {
      ents = await fs.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }

    for (const ent of ents) {
      if (ent.isDirectory()) {
        await walk(path.join(d, ent.name));
      }
    }

    try {
      const rest = await fs.readdir(d);
      if (rest.length === 0 && path.resolve(d) !== path.resolve(absRoot)) {
        await fs.rmdir(d);
        removed += 1;
      }
    } catch {
      /* ignore */
    }
  }

  await walk(absRoot);
  return removed;
}

function collectUrls(row: {
  originalUrl: string;
  croppedUrl: string | null;
  renderedUrl: string | null;
}): string[] {
  const raw = [row.originalUrl, row.croppedUrl, row.renderedUrl].filter(
    (u): u is string => typeof u === "string" && u.trim().length > 0,
  );
  return [...new Set(raw.map((u) => u.trim()))];
}

/**
 * Deletes order-media blobs for orders past {@link ORDER_MEDIA_RETENTION_DAYS}.
 * Only `Order` rows with `status === PAID` and `paymentStatus === PAID` (excludes CASH-only, pending, unpaid).
 * Never deletes `Order`, `OrderImage` rows — sets `OrderImage.mediaDeletedAt` when all URLs were gone or removed.
 */
export async function cleanupOrderMedia(
  options: CleanupOrderMediaOptions = {},
): Promise<CleanupOrderMediaResult> {
  const dryRun = options.dryRun !== false;
  const retentionDays = ORDER_MEDIA_RETENTION_DAYS;
  const now = new Date();
  const cutoffMs =
    now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  const cutoff = new Date(cutoffMs);

  const errors: OrderMediaCleanupError[] = [];

  const paidStatusOrders = await prisma.order.findMany({
    where: { status: PAID_ELIGIBLE_STATUS },
    select: {
      id: true,
      createdAt: true,
      status: true,
      paymentStatus: true,
    },
  });

  const fullySettledOrders = paidStatusOrders.filter(isFullyPaidEligibleOrder);
  const ordersScanned = fullySettledOrders.length;

  const eligibleIds = fullySettledOrders
    .filter((o) => o.createdAt < cutoff)
    .map((o) => o.id);
  const ordersEligible = eligibleIds.length;

  const pendingImages =
    eligibleIds.length === 0
      ? []
      : await prisma.orderImage.findMany({
          where: {
            orderId: { in: eligibleIds },
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

  const filesByOrder = new Map<string, number>();
  for (const row of pendingImages) {
    const urls = collectUrls(row);
    filesFound += urls.length;
    filesByOrder.set(row.orderId, (filesByOrder.get(row.orderId) ?? 0) + urls.length);
    for (const url of urls) {
      if (!isDeletableOrderMediaUrl(url)) {
        filesSkipped += 1;
      }
    }
  }

  const dryExtras =
    dryRun
      ? {
          eligibleOrderIds: [...eligibleIds].sort(),
          filesFoundByOrder: [...eligibleIds]
            .sort()
            .map((orderId) => ({
              orderId,
              count: filesByOrder.get(orderId) ?? 0,
            })),
        }
      : {};

  console.info(
    `[order-media-cleanup] dryRun=${dryRun} eligibleOrders=${ordersEligible} pendingImages=${orderImagesFound} urls=${filesFound}`,
  );

  if (dryRun) {
    for (const row of pendingImages) {
      for (const url of collectUrls(row)) {
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
      ordersScanned,
      ordersEligible,
      orderImagesFound,
      filesFound,
      filesDeleted: 0,
      filesAlreadyMissing: 0,
      filesSkipped,
      orderImagesMarkedDeleted: 0,
      foldersDeleted: 0,
      errors,
      retentionDays,
      ...dryExtras,
    };
  }

  let filesDeleted = 0;
  let filesAlreadyMissing = 0;
  let orderImagesMarkedDeleted = 0;

  const deletedAt = now;

  for (const row of pendingImages) {
    const urls = collectUrls(row);

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
          "[order-media-cleanup] delete failed",
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

  let foldersDeleted = 0;
  const roots = [
    path.resolve(process.cwd(), "uploads", "order-images"),
    path.resolve(process.cwd(), "uploads", "order-images-rendered"),
  ];

  for (const root of roots) {
    try {
      foldersDeleted += await pruneEmptyDirsUnderRoot(root);
    } catch (e: unknown) {
      errors.push({
        message: `Empty folder prune: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  console.info(
    `[order-media-cleanup] completed deleted=${filesDeleted} missing=${filesAlreadyMissing} marked=${orderImagesMarkedDeleted}`,
  );

  return {
    dryRun: false,
    ordersScanned,
    ordersEligible,
    orderImagesFound,
    filesFound,
    filesDeleted,
    filesAlreadyMissing,
    filesSkipped,
    orderImagesMarkedDeleted,
    foldersDeleted,
    errors,
    retentionDays,
  };
}
