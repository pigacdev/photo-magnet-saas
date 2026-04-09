import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "./prisma";

/**
 * Minimal shape for rendering (e.g. Prisma OrderImage rows).
 * Crop fields are used as-is for extract(); only rounded for Sharp integer requirement.
 */
export type OrderImageRenderInput = {
  id: string;
  originalUrl: string;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
};

/** Local disk path under process.cwd() from a same-origin `/uploads/...` URL. */
function resolveLocalInputPath(originalUrl: string): string {
  if (originalUrl.startsWith("http://") || originalUrl.startsWith("https://")) {
    throw new Error(
      "renderOrderImages: remote originals are not supported; expected a local /uploads/ path",
    );
  }
  const rel = originalUrl.replace(/^\/+/, "");
  return path.join(process.cwd(), rel);
}

/**
 * Extracts the crop rectangle from each source file and writes a JPEG (no resize/scale).
 * Crop rectangle uses integer pixel bounds (Sharp); values are rounded from stored pixels only.
 */
export async function renderOrderImages(
  orderId: string,
  images: OrderImageRenderInput[],
): Promise<void> {
  const baseDir = path.join(
    process.cwd(),
    "uploads",
    "order-images-rendered",
    orderId,
  );

  await fs.mkdir(baseDir, { recursive: true });

  console.log("🖨 Rendering order:", orderId);

  for (const img of images) {
    console.log("→ Rendering image:", img.id);

    const inputPath = resolveLocalInputPath(img.originalUrl);

    const outputPath = path.join(baseDir, `${img.id}.jpg`);

    const left = Math.round(img.cropX);
    const top = Math.round(img.cropY);
    const width = Math.round(img.cropWidth);
    const height = Math.round(img.cropHeight);

    if (width < 1 || height < 1) {
      throw new Error(
        `renderOrderImages: invalid crop dimensions for image ${img.id} (${width}x${height})`,
      );
    }

    await sharp(inputPath)
      .extract({
        left,
        top,
        width,
        height,
      })
      .jpeg({ quality: 95 })
      .toFile(outputPath);

    const renderedUrl = `/uploads/order-images-rendered/${orderId}/${img.id}.jpg`;
    try {
      await prisma.orderImage.update({
        where: { id: img.id },
        data: { renderedUrl },
      });
    } catch (dbErr) {
      console.error(
        "[renderOrderImages] failed to persist renderedUrl",
        img.id,
        dbErr,
      );
    }
  }
}
