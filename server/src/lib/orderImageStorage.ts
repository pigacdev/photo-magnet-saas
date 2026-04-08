import fs from "node:fs/promises";
import path from "node:path";
import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { s3Config } from "../config/s3";
import {
  buildS3PublicUrl,
  extractS3KeyFromPublicUrl,
  getS3Client,
} from "./sessionImageStorage";

export type OrderImageStorageKind = "local" | "s3";

function extensionFromSessionUrl(sessionImageUrl: string): string {
  const pathPart = sessionImageUrl.split("?")[0] ?? sessionImageUrl;
  const fileName = pathPart.split("/").pop() ?? "";
  const dot = fileName.lastIndexOf(".");
  if (dot >= 0) return fileName.slice(dot);
  return ".jpg";
}

function isS3SessionImageUrl(sessionImageUrl: string): boolean {
  return Boolean(s3Config.bucket && sessionImageUrl.startsWith("http"));
}

/**
 * Copies a session upload into order-scoped storage so OrderImage rows do not depend on session paths.
 * Local: uploads/order-images/{orderId}/{imageId}{ext}
 * S3: order-images/{orderId}/{imageId}{ext}
 */
export async function copySessionImageToOrder(params: {
  sessionImageUrl: string;
  orderId: string;
  imageId: string;
}): Promise<string> {
  const ext = extensionFromSessionUrl(params.sessionImageUrl);
  const destFileName = `${params.imageId}${ext}`;
  const destKey = path.posix.join("order-images", params.orderId, destFileName);

  if (isS3SessionImageUrl(params.sessionImageUrl)) {
    const srcKey = extractS3KeyFromPublicUrl(params.sessionImageUrl);
    if (!srcKey) {
      throw new Error("Could not resolve S3 key for session image");
    }
    const bucket = s3Config.bucket!;
    const client = getS3Client();
    // CopySource: bucket/key — encode key but keep "/" as path separators (AWS convention).
    const copySource = `${bucket}/${encodeURIComponent(srcKey).replace(/%2F/g, "/")}`;
    await client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: copySource,
        Key: destKey,
      }),
    );
    return buildS3PublicUrl(destKey);
  }

  const pathname = params.sessionImageUrl.startsWith("http")
    ? new URL(params.sessionImageUrl).pathname
    : params.sessionImageUrl;
  const withoutLeading = pathname.replace(/^\/+/, "");
  const srcAbs = path.join(process.cwd(), withoutLeading);
  const destDir = path.join(process.cwd(), "uploads", "order-images", params.orderId);
  await fs.mkdir(destDir, { recursive: true });
  const destAbs = path.join(destDir, destFileName);
  await fs.copyFile(srcAbs, destAbs);
  const relativeKey = path.posix.join("order-images", params.orderId, destFileName);
  return `/uploads/${relativeKey.replace(/\\/g, "/")}`;
}

export function orderImageStorageKindFromSessionUrl(
  sessionImageUrl: string,
): OrderImageStorageKind {
  return isS3SessionImageUrl(sessionImageUrl) ? "s3" : "local";
}
