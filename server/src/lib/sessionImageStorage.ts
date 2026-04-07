import fs from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { s3Config } from "../config/s3";

export const SESSION_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

const SESSION_MIMES = new Set<string>(s3Config.sessionUploadMimeTypes);

export function isSessionUploadMime(mime: string): boolean {
  return SESSION_MIMES.has(mime);
}

export function extForSessionMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/heic":
    case "image/heif":
      return ".heic";
    default:
      return "";
  }
}

/** Shown when HEIC/HEIF decode fails (e.g. Sharp/libvips without libheif). Never surface Sharp errors. */
export const HEIC_DEVICE_UNSUPPORTED_MESSAGE =
  "This format is not supported on this device. Please upload JPG or PNG.";

export function isHeicLikeMime(mime: string): boolean {
  return mime === "image/heic" || mime === "image/heif";
}

export async function readImageDimensions(
  buffer: Buffer,
  mimeType: string,
): Promise<{
  width: number;
  height: number;
}> {
  try {
    const meta = await sharp(buffer).metadata();
    if (meta.width == null || meta.height == null) {
      throw new Error("Could not read image dimensions");
    }
    return { width: meta.width, height: meta.height };
  } catch {
    if (isHeicLikeMime(mimeType)) {
      throw new Error(HEIC_DEVICE_UNSUPPORTED_MESSAGE);
    }
    throw new Error("Could not read image dimensions");
  }
}

function getS3Client(): S3Client {
  return new S3Client({
    region: s3Config.region,
    endpoint: s3Config.endpoint,
    credentials:
      s3Config.accessKeyId && s3Config.secretAccessKey
        ? {
            accessKeyId: s3Config.accessKeyId,
            secretAccessKey: s3Config.secretAccessKey,
          }
        : undefined,
    forcePathStyle: Boolean(s3Config.endpoint),
  });
}

function buildS3PublicUrl(key: string): string {
  const { bucket, region, endpoint } = s3Config;
  if (endpoint) {
    const base = endpoint.replace(/\/$/, "");
    return `${base}/${bucket}/${key}`;
  }
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

function extractS3KeyFromPublicUrl(originalUrl: string): string | null {
  const { bucket, region, endpoint } = s3Config;
  if (!bucket) return null;
  try {
    const u = new URL(originalUrl);
    if (endpoint) {
      const base = endpoint.replace(/\/$/, "");
      const prefix = `${base}/${bucket}/`;
      if (originalUrl.startsWith(prefix)) {
        return originalUrl.slice(prefix.length);
      }
      return null;
    }
    const expectedHost = `${bucket}.s3.${region}.amazonaws.com`;
    if (u.hostname === expectedHost) {
      return u.pathname.replace(/^\//, "");
    }
    return null;
  } catch {
    return null;
  }
}

export async function putSessionImageObject(params: {
  sessionId: string;
  imageId: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<{ originalUrl: string }> {
  const ext = extForSessionMime(params.mimeType);
  if (!ext) {
    throw new Error("Unsupported mime type");
  }
  const relativeKey = path.posix.join(
    "session-images",
    params.sessionId,
    `${params.imageId}${ext}`,
  );

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
    return { originalUrl: buildS3PublicUrl(relativeKey) };
  }

  const dir = path.join(process.cwd(), "uploads", "session-images", params.sessionId);
  await fs.mkdir(dir, { recursive: true });
  const diskPath = path.join(dir, `${params.imageId}${ext}`);
  await fs.writeFile(diskPath, params.buffer);

  /** Same-origin path so Next `/uploads` rewrite can serve thumbnails. */
  const urlPath = `/uploads/${relativeKey.replace(/\\/g, "/")}`;
  return { originalUrl: urlPath };
}

export async function deleteSessionImageObject(originalUrl: string): Promise<void> {
  if (s3Config.bucket && originalUrl.startsWith("http")) {
    const key = extractS3KeyFromPublicUrl(originalUrl);
    if (!key) {
      throw new Error("Could not resolve S3 key for delete");
    }
    const client = getS3Client();
    await client.send(
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
  await fs.unlink(diskPath).catch((e: NodeJS.ErrnoException) => {
    if (e.code !== "ENOENT") throw e;
  });
}
