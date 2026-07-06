/**
 * ZIP export for ended events — paid order media only (local disk paths).
 * TODO: Stream objects from S3 when order media URLs resolve to bucket keys (currently skipped).
 */
import archiver from "archiver";
import fs from "node:fs/promises";
import path from "node:path";
import type { Response } from "express";
import { prisma } from "./prisma";
import { ORDER_IMAGE_LIST_ORDER_BY } from "./magnetImageOrderBy";
import {
  extractS3KeyFromPublicUrl,
} from "./sessionImageStorage";
import { isDeletableOrderMediaUrl } from "./orderMediaCleanup";
import { renderOrderImages, type OrderImageRenderInput } from "./renderOrderImages";
import { s3Config } from "../config/s3";
import { EVENT_MEDIA_RETENTION_HOURS_AFTER_END } from "../config/mediaRetention";
import { csvEscape } from "./csvEscape";

const MS_PER_HOUR = 60 * 60 * 1000;

const SETTLED_ORDER_STATUSES = new Set([
  "PAID",
  "IN_PRODUCTION",
  "SHIPPED",
  "COMPLETED",
]);

function isPaidOrder(o: { status: string }): boolean {
  return SETTLED_ORDER_STATUSES.has(o.status);
}

/** ASCII-ish slug for ZIP paths / Content-Disposition. */
function sanitizeZipSegment(raw: string, maxLen = 48): string {
  const s = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLen);
  return s.length > 0 ? s : "event";
}

/** Resolve order-media URL to an absolute local file path, or null if remote/S3/missing/unsafe. */
async function resolveSafeLocalOrderMediaFile(
  url: string,
): Promise<string | null> {
  if (!isDeletableOrderMediaUrl(url)) return null;

  if (url.startsWith("http") && s3Config.bucket) {
    const key = extractS3KeyFromPublicUrl(url);
    if (
      key &&
      (key.startsWith("order-images/") ||
        key.startsWith("order-images-rendered/"))
    ) {
      return null;
    }
  }

  try {
    const pathname = url.startsWith("http")
      ? new URL(url).pathname
      : url;
    const relativeFromCwd = pathname.replace(/^\/+/, "").replace(/\\/g, "/");
    if (
      !relativeFromCwd.startsWith("uploads/order-images/") &&
      !relativeFromCwd.startsWith("uploads/order-images-rendered/")
    ) {
      return null;
    }

    const abs = path.resolve(process.cwd(), relativeFromCwd);
    const roots = [
      path.resolve(process.cwd(), "uploads", "order-images"),
      path.resolve(process.cwd(), "uploads", "order-images-rendered"),
    ];

    for (const root of roots) {
      const rel = path.relative(root, abs);
      if (rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel)) {
        try {
          const st = await fs.stat(abs);
          return st.isFile() ? abs : null;
        } catch {
          return null;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

type OrderImageZipRow = {
  id: string;
  copies: number;
  originalUrl: string;
  croppedUrl: string | null;
  renderedUrl: string | null;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  rotation: number;
};

/** Original must be a local, non-http path with file on disk — matches {@link renderOrderImages} constraints. */
async function originalFileReadyForRenderPipeline(
  originalUrl: string,
): Promise<boolean> {
  const trimmed = originalUrl.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return false;
  }
  if (!isDeletableOrderMediaUrl(trimmed)) return false;
  const rel = trimmed.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!rel.startsWith("uploads/order-images/")) return false;
  const inputPath = path.join(process.cwd(), rel);
  const root = path.resolve(process.cwd(), "uploads", "order-images");
  const relToRoot = path.relative(root, path.resolve(inputPath));
  if (relToRoot.startsWith("..") || path.isAbsolute(relToRoot)) return false;
  try {
    const st = await fs.stat(inputPath);
    return st.isFile();
  } catch {
    return false;
  }
}

function cropDimensionsValid(img: OrderImageZipRow): boolean {
  const w = Math.round(img.cropWidth);
  const h = Math.round(img.cropHeight);
  return w >= 1 && h >= 1;
}

/**
 * Resolves print-ready media only: existing rendered/cropped assets, or generates rendered JPEG via
 * {@link renderOrderImages}. Never returns the raw `originalUrl` file.
 */
async function resolveFinalOrderImageForZip(
  orderId: string,
  img: OrderImageZipRow,
): Promise<
  | { ok: true; absPath: string; sourceNote: string }
  | { ok: false; attempted: string; reason: string }
> {
  const attempts: string[] = [];

  const trimmedRendered = img.renderedUrl?.trim();
  if (trimmedRendered) {
    attempts.push("renderedUrl");
    const abs = await resolveSafeLocalOrderMediaFile(trimmedRendered);
    if (abs) {
      return { ok: true, absPath: abs, sourceNote: "renderedUrl" };
    }
  }

  const trimmedCropped = img.croppedUrl?.trim();
  if (trimmedCropped) {
    attempts.push("croppedUrl");
    const abs = await resolveSafeLocalOrderMediaFile(trimmedCropped);
    if (abs) {
      return { ok: true, absPath: abs, sourceNote: "croppedUrl" };
    }
  }

  if (!cropDimensionsValid(img)) {
    return {
      ok: false,
      attempted: attempts.join("; ") || "none",
      reason: "invalid_or_missing_crop_no_generated_asset",
    };
  }

  const originalOk = await originalFileReadyForRenderPipeline(img.originalUrl);
  if (!originalOk) {
    const remoteOriginal = img.originalUrl.trim().startsWith("http");
    if (
      remoteOriginal &&
      s3Config.bucket &&
      (() => {
        const key = extractS3KeyFromPublicUrl(img.originalUrl.trim());
        return Boolean(
          key &&
            (key.startsWith("order-images/") ||
              key.startsWith("order-images-rendered/")),
        );
      })()
    ) {
      return {
        ok: false,
        attempted: [...attempts, "render_from_crop"].join("; "),
        reason: "s3_original_not_supported_for_render_pipeline",
      };
    }
    return {
      ok: false,
      attempted: [...attempts, "render_from_crop"].join("; "),
      reason: "original_not_available_locally_for_render_pipeline",
    };
  }

  attempts.push("render_from_crop");

  const renderInput: OrderImageRenderInput = {
    id: img.id,
    originalUrl: img.originalUrl.trim(),
    cropX: img.cropX,
    cropY: img.cropY,
    cropWidth: img.cropWidth,
    cropHeight: img.cropHeight,
    rotation: img.rotation,
  };

  try {
    await renderOrderImages(orderId, [renderInput]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const short =
      msg.length > 120 ? `${msg.slice(0, 117)}...` : msg;
    return {
      ok: false,
      attempted: attempts.join("; "),
      reason: `render_pipeline_failed:${short}`,
    };
  }

  const renderedAbs = path.join(
    process.cwd(),
    "uploads",
    "order-images-rendered",
    orderId,
    `${img.id}.jpg`,
  );
  try {
    const st = await fs.stat(renderedAbs);
    if (st.isFile()) {
      return {
        ok: true,
        absPath: renderedAbs,
        sourceNote: "generated_via_renderOrderImages",
      };
    }
  } catch {
    /* missing */
  }

  return {
    ok: false,
    attempted: attempts.join("; "),
    reason: "render_output_missing_after_pipeline",
  };
}

function extensionForEntry(absPath: string, fallbackUrl: string): string {
  const ext = path.extname(absPath);
  if (ext && /^\.[a-zA-Z0-9]+$/.test(ext)) return ext;
  try {
    const p =
      fallbackUrl.startsWith("http")
        ? new URL(fallbackUrl).pathname
        : fallbackUrl;
    const e = path.extname(p);
    if (e && /^\.[a-zA-Z0-9]+$/.test(e)) return e;
  } catch {
    /* ignore */
  }
  return ".jpg";
}

function allocateOrderFolderKey(
  order: { id: string; shortCode: string | null },
  used: Set<string>,
): string {
  const baseRaw = order.shortCode?.trim() || order.id.slice(0, 8);
  let base = sanitizeZipSegment(baseRaw, 40);
  if (!base) base = sanitizeZipSegment(order.id.slice(0, 8), 40);
  let key = base;
  let n = 0;
  while (used.has(key)) {
    n += 1;
    key = `${base}-${n}`;
  }
  used.add(key);
  return `order-${key}`;
}

/**
 * Streams a ZIP of paid EVENT orders’ media into `res`.
 * Sets Content-Type / Content-Disposition; responds with JSON only on error before streaming.
 */
export async function streamEndedEventMediaZip(
  res: Response,
  eventId: string,
  sellerUserId: string,
): Promise<void> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, userId: sellerUserId, deletedAt: null },
  });

  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const now = new Date();
  if (now <= event.endDate) {
    res.status(403).json({
      error: "Export is only available after the event has ended",
    });
    return;
  }

  const mediaDeletionAt = new Date(
    event.endDate.getTime() +
      EVENT_MEDIA_RETENTION_HOURS_AFTER_END * MS_PER_HOUR,
  );
  if (now.getTime() > mediaDeletionAt.getTime()) {
    res.status(410).json({
      error: "Event media export window has expired.",
    });
    return;
  }

  const ordersRaw = await prisma.order.findMany({
    where: {
      organizationId: sellerUserId,
      contextType: "EVENT",
      contextId: eventId,
    },
    select: {
      id: true,
      shortCode: true,
      createdAt: true,
      customerName: true,
      customerPhone: true,
      totalPrice: true,
      currency: true,
      status: true,
      printedAt: true,
      shippedAt: true,
      orderImages: {
        orderBy: ORDER_IMAGE_LIST_ORDER_BY,
        select: {
          id: true,
          copies: true,
          originalUrl: true,
          croppedUrl: true,
          renderedUrl: true,
          cropX: true,
          cropY: true,
          cropWidth: true,
          cropHeight: true,
          rotation: true,
        },
      },
    },
  });

  const orders = ordersRaw.filter(isPaidOrder);

  const zipFolderBase = sanitizeZipSegment(event.name || event.id, 56);
  const zipRoot = `event-${zipFolderBase}`;
  const attachmentStem = sanitizeZipSegment(zipFolderBase, 80);

  const archive = archiver("zip", { zlib: { level: 6 } });

  archive.on("error", (err: Error) => {
    console.error("[event-export.zip]", err);
  });

  const csvHeader = [
    "order_id",
    "short_code",
    "created_at",
    "customer_name",
    "customer_phone",
    "total_price",
    "currency",
    "payment_status",
    "printed_at",
    "shipped_at",
    "unique_images",
    "total_copies",
    "media_files_included",
    "media_files_missing",
  ].join(",");

  const csvRows: string[] = [csvHeader];
  const skippedLines: string[] = [
    "order_id\tfolder\timage_index\tcopies\tattempts\tskip_reason",
  ];

  const folderUsed = new Set<string>();
  let totalIncluded = 0;

  for (const order of orders) {
    const orderFolder = allocateOrderFolderKey(order, folderUsed);
    const uniqueImages = order.orderImages.length;
    const totalCopies = order.orderImages.reduce((s, i) => s + i.copies, 0);

    let included = 0;
    let missing = 0;

    let imgIdx = 0;
    for (const img of order.orderImages) {
      imgIdx += 1;
      const resolved = await resolveFinalOrderImageForZip(order.id, img);

      if (resolved.ok) {
        const ext = extensionForEntry(resolved.absPath, resolved.sourceNote);
        const entryPath = `${zipRoot}/${orderFolder}/image-${imgIdx}-copies-${img.copies}${ext}`;
        archive.file(resolved.absPath, { name: entryPath });
        included += 1;
        totalIncluded += 1;
      } else {
        missing += 1;
        skippedLines.push(
          [
            order.id,
            orderFolder,
            String(imgIdx),
            String(img.copies),
            resolved.attempted.replace(/\r?\n|\t/g, " "),
            resolved.reason.replace(/\r?\n|\t/g, " "),
          ].join("\t"),
        );
      }
    }

    csvRows.push(
      [
        csvEscape(order.id),
        csvEscape(order.shortCode ?? ""),
        csvEscape(order.createdAt.toISOString()),
        csvEscape(order.customerName ?? ""),
        csvEscape(order.customerPhone ?? ""),
        csvEscape(order.totalPrice.toString()),
        csvEscape(order.currency ?? "EUR"),
        csvEscape(order.status),
        csvEscape(order.printedAt?.toISOString() ?? ""),
        csvEscape(order.shippedAt?.toISOString() ?? ""),
        String(uniqueImages),
        String(totalCopies),
        String(included),
        String(missing),
      ].join(","),
    );
  }

  const readmeLines = [
    "Event media export (paid orders only).",
    "Database rows are not modified by this export.",
    "",
    "Image files are print-ready only (customer crop / rendered JPEG). Raw originals are never included.",
    "Missing assets may be regenerated on the fly from local originals using the same pipeline as seller print previews when possible.",
    "",
    "Some files may be missing because:",
    "- Retention cleanup already removed blobs (check media_files_missing in orders.csv).",
    "- Assets are stored on S3-only URLs — ZIP packing and render input from S3 are not implemented yet (TODO).",
    "",
    totalIncluded === 0
      ? "No downloadable media files were found on disk for this export."
      : `Included ${totalIncluded} media file(s).`,
    "",
    `Orders included (paid): ${orders.length}`,
  ];

  archive.append(csvRows.join("\r\n"), {
    name: `${zipRoot}/orders.csv`,
  });
  archive.append(readmeLines.join("\r\n"), {
    name: `${zipRoot}/README.txt`,
  });
  if (skippedLines.length > 1) {
    archive.append(skippedLines.join("\r\n"), {
      name: `${zipRoot}/MEDIA_SKIPPED.txt`,
    });
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${attachmentStem}.zip"`,
  );

  archive.pipe(res);

  await new Promise<void>((resolve, reject) => {
    archive.on("error", reject);
    archive.on("end", resolve);
    void archive.finalize();
  });
}
