import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import {
  buildS3PublicUrl,
  deleteSessionImageObject,
  extractS3KeyFromPublicUrl,
  getS3Client,
} from "./sessionImageStorage";
import { s3Config } from "../config/s3";

export const EVENT_BANNER_MAX_BYTES = 2 * 1024 * 1024;
export const EVENT_BANNER_MAX_WIDTH_PX = 1600;

/** Append cache-bust param so replaced banners refresh in the browser. */
export function withBannerCacheBust(
  bannerUrl: string | null | undefined,
  updatedAt: Date,
): string | null {
  if (!bannerUrl) return null;
  const sep = bannerUrl.includes("?") ? "&" : "?";
  return `${bannerUrl}${sep}v=${updatedAt.getTime()}`;
}

const BANNER_MIMES = new Set(["image/jpeg", "image/png"]);

export function isEventBannerMime(mime: string): boolean {
  return BANNER_MIMES.has(mime);
}

export function extForEventBannerMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    default:
      return "";
  }
}

export async function prepareEventBannerBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!isEventBannerMime(mimeType)) {
    throw new Error("Only JPG and PNG images are supported");
  }

  try {
    let pipeline = sharp(buffer);
    const meta = await pipeline.metadata();
    if (meta.width == null || meta.height == null) {
      throw new Error("Could not read image");
    }

    if (meta.width > EVENT_BANNER_MAX_WIDTH_PX) {
      pipeline = pipeline.resize({
        width: EVENT_BANNER_MAX_WIDTH_PX,
        withoutEnlargement: true,
      });
    }

    if (mimeType === "image/png") {
      const out = await pipeline.png().toBuffer();
      return { buffer: out, mimeType: "image/png" };
    }

    const out = await pipeline.jpeg({ quality: 85 }).toBuffer();
    return { buffer: out, mimeType: "image/jpeg" };
  } catch {
    throw new Error("Could not read image");
  }
}

function eventBannerRelativeKey(eventId: string, ext: string): string {
  return path.posix.join("event-banners", `${eventId}${ext}`);
}

export async function putEventBannerObject(params: {
  eventId: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<{ bannerUrl: string }> {
  const ext = extForEventBannerMime(params.mimeType);
  if (!ext) {
    throw new Error("Unsupported mime type");
  }

  const relativeKey = eventBannerRelativeKey(params.eventId, ext);

  if (s3Config.bucket) {
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: s3Config.bucket,
        Key: relativeKey,
        Body: params.buffer,
        ContentType: params.mimeType,
      }),
    );
    return { bannerUrl: buildS3PublicUrl(relativeKey) };
  }

  const dir = path.join(process.cwd(), "uploads", "event-banners");
  await fs.mkdir(dir, { recursive: true });
  const diskPath = path.join(dir, `${params.eventId}${ext}`);
  await fs.writeFile(diskPath, params.buffer);

  const urlPath = `/uploads/${relativeKey.replace(/\\/g, "/")}`;
  return { bannerUrl: urlPath };
}

function isDeletableEventBannerUrl(bannerUrl: string, eventId: string): boolean {
  if (s3Config.bucket && bannerUrl.startsWith("http")) {
    const key = extractS3KeyFromPublicUrl(bannerUrl);
    return key === eventBannerRelativeKey(eventId, ".jpg") ||
      key === eventBannerRelativeKey(eventId, ".png");
  }

  let relativeFromCwd: string;
  try {
    const pathname = bannerUrl.startsWith("http")
      ? new URL(bannerUrl).pathname
      : bannerUrl;
    relativeFromCwd = pathname.replace(/^\/+/, "").replace(/\\/g, "/");
  } catch {
    return false;
  }

  const expectedJpg = `uploads/event-banners/${eventId}.jpg`;
  const expectedPng = `uploads/event-banners/${eventId}.png`;
  if (relativeFromCwd !== expectedJpg && relativeFromCwd !== expectedPng) {
    return false;
  }

  const abs = path.resolve(process.cwd(), relativeFromCwd);
  const root = path.resolve(process.cwd(), "uploads", "event-banners");
  const rel = path.relative(root, abs);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

export async function deleteEventBannerObject(
  bannerUrl: string,
  eventId: string,
): Promise<void> {
  if (!isDeletableEventBannerUrl(bannerUrl, eventId)) {
    return;
  }
  await deleteSessionImageObject(bannerUrl);
}
