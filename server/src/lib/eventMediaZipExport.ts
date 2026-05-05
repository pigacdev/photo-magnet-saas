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
import { s3Config } from "../config/s3";

function isPaidOrder(o: { status: string; paymentStatus: string }): boolean {
  return o.status === "PAID" && o.paymentStatus === "PAID";
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

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
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

function pickCandidateUrls(img: {
  originalUrl: string;
  croppedUrl: string | null;
  renderedUrl: string | null;
}): string[] {
  const out: string[] = [];
  const push = (u: string | null | undefined) => {
    if (typeof u === "string" && u.trim().length > 0) out.push(u.trim());
  };
  push(img.renderedUrl);
  push(img.croppedUrl);
  push(img.originalUrl);
  return out;
}

function skipReasonForUrls(urls: string[]): string {
  if (urls.length === 0) return "no_url_candidates";
  if (
    urls.every((u) => u.startsWith("http")) &&
    s3Config.bucket &&
    urls.every((u) => {
      const key = extractS3KeyFromPublicUrl(u);
      return Boolean(
        key &&
          (key.startsWith("order-images/") ||
            key.startsWith("order-images-rendered/")),
      );
    })
  ) {
    return "s3_remote_not_supported_yet";
  }
  return "missing_local_file";
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
      paymentStatus: true,
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
    "order_id\tfolder\timage_index\tcopies\turls_attempted\tskip_reason",
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
      const candidates = pickCandidateUrls(img);
      let resolvedAbs: string | null = null;
      let usedUrl = "";

      for (const url of candidates) {
        const abs = await resolveSafeLocalOrderMediaFile(url);
        if (abs) {
          resolvedAbs = abs;
          usedUrl = url;
          break;
        }
      }

      if (resolvedAbs) {
        const ext = extensionForEntry(resolvedAbs, usedUrl);
        const entryPath = `${zipRoot}/${orderFolder}/image-${imgIdx}-copies-${img.copies}${ext}`;
        archive.file(resolvedAbs, { name: entryPath });
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
            candidates.join("; ").replace(/\r?\n|\t/g, " "),
            skipReasonForUrls(candidates),
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
        csvEscape(order.paymentStatus),
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
    "Some files may be missing because:",
    "- Retention cleanup already removed blobs (check media_files_missing in orders.csv).",
    "- Assets are stored on S3-only URLs — ZIP packing from S3 is not implemented yet (TODO).",
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
