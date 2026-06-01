/**
 * Session image uploads (Phase 5C): GET/POST/DELETE /api/session/images
 */
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { Router } from "express";
import multer from "multer";
import type {
  AllowedShape,
  OrderSession,
} from "../../../src/generated/prisma/client";
import { prisma } from "../lib/prisma";
import { sessionConfig } from "../config/session";
import {
  clearSessionCookie,
  type ApiSessionImage,
  serializeSessionImage,
} from "../lib/orderSessionApi";
import { validateOrderSessionContext } from "../lib/sessionContextValidation";
import {
  deleteSessionImageObject,
  isSessionUploadMime,
  putSessionImageObject,
  readImageDimensions,
  SESSION_UPLOAD_MAX_BYTES,
} from "../lib/sessionImageStorage";
import { MAX_MULTIPART_FILES_PER_REQUEST } from "../../../src/lib/sessionImageLimits";
import { getMinRequiredPx } from "../../../src/lib/minRequiredPxForShape";
import { getMaxImagesAllowed } from "../lib/sessionImageMaxFromSession";
import { SESSION_IMAGE_LIST_ORDER_BY } from "../lib/magnetImageOrderBy";

export const sessionImagesRouter = Router();

/**
 * Clamps crop to valid pixel rect inside the original image (fixes float / edge drift).
 * Order matches product rules: position first, then size against remaining span.
 */
function clampCropRectToImage(
  imageWidth: number,
  imageHeight: number,
  rawX: number,
  rawY: number,
  rawW: number,
  rawH: number,
): { cropX: number; cropY: number; cropWidth: number; cropHeight: number } {
  const clamp = (n: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, n));

  let cropX = clamp(Math.round(rawX), 0, imageWidth);
  let cropY = clamp(Math.round(rawY), 0, imageHeight);
  let cropWidth = clamp(Math.round(rawW), 1, imageWidth - cropX);
  let cropHeight = clamp(Math.round(rawH), 1, imageHeight - cropY);

  if (cropX + cropWidth > imageWidth) {
    cropX = imageWidth - cropWidth;
  }
  if (cropY + cropHeight > imageHeight) {
    cropY = imageHeight - cropHeight;
  }
  cropX = clamp(cropX, 0, imageWidth);
  cropY = clamp(cropY, 0, imageHeight);
  cropWidth = clamp(cropWidth, 1, imageWidth - cropX);
  cropHeight = clamp(cropHeight, 1, imageHeight - cropY);

  /** Print / storage: whole pixels only (no fractional crop rects). */
  return {
    cropX: Math.round(cropX),
    cropY: Math.round(cropY),
    cropWidth: Math.round(cropWidth),
    cropHeight: Math.round(cropHeight),
  };
}

/** Matches fixed-frame UI: RECTANGLE uses mm aspect; circle/square use 1:1. */
const ASPECT_RATIO_TOLERANCE = 0.01;

function expectedCropAspectRatio(shape: AllowedShape): number {
  if (shape.shapeType === "RECTANGLE") {
    const ar = shape.widthMm / shape.heightMm;
    return ar > 0 && Number.isFinite(ar) ? ar : 1;
  }
  return 1;
}

/**
 * If the clamped crop drifts from the magnet aspect (float / tampering), snap to the
 * closest integer width×height that matches within tolerance and fits at (cx, cy).
 */
function snapCropRectToShapeAspectRatio(
  imageWidth: number,
  imageHeight: number,
  cx: number,
  cy: number,
  cropWidth: number,
  cropHeight: number,
  expectedRatio: number,
):
  | { cropX: number; cropY: number; cropWidth: number; cropHeight: number }
  | null {
  const tol = ASPECT_RATIO_TOLERANCE;
  const maxW = imageWidth - cx;
  const maxH = imageHeight - cy;
  if (maxW < 1 || maxH < 1) return null;

  const ratioOk = (w: number, h: number) =>
    Math.abs(w / h - expectedRatio) <= tol;

  if (ratioOk(cropWidth, cropHeight)) {
    return { cropX: cx, cropY: cy, cropWidth, cropHeight };
  }

  let bestW = 0;
  let bestH = 0;
  let bestScore = Number.POSITIVE_INFINITY;

  const consider = (w: number, h: number) => {
    if (w < 1 || h < 1 || w > maxW || h > maxH) return;
    if (!ratioOk(w, h)) return;
    const dw = w - cropWidth;
    const dh = h - cropHeight;
    const score = dw * dw + dh * dh;
    if (score < bestScore) {
      bestScore = score;
      bestW = w;
      bestH = h;
    }
  };

  for (let w = 1; w <= maxW; w++) {
    const h = Math.max(1, Math.round(w / expectedRatio));
    consider(w, h);
  }
  for (let h = 1; h <= maxH; h++) {
    const w = Math.max(1, Math.round(h * expectedRatio));
    consider(w, h);
  }

  if (bestScore === Number.POSITIVE_INFINITY) return null;

  return {
    cropX: cx,
    cropY: cy,
    cropWidth: bestW,
    cropHeight: bestH,
  };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: SESSION_UPLOAD_MAX_BYTES },
});

/**
 * GET /images: list when session is ACTIVE (shape not required).
 *
 * Also allows CONVERTED sessions (read-only) so the customer can navigate
 * back to /order/review after commit (e.g. from /order/customer) without
 * being bounced to the entry page. Crop / upload / delete still require
 * an ACTIVE session via `requireActiveSessionForMutation`.
 */
async function resolveActiveSessionForRead(
  req: Request,
  res: Response,
): Promise<OrderSession | null> {
  const sessionId = req.cookies?.[sessionConfig.cookieName] as string | undefined;
  if (!sessionId) return null;

  const session = await prisma.orderSession.findUnique({
    where: { id: sessionId },
  });
  const now = new Date();

  if (!session) {
    clearSessionCookie(res);
    return null;
  }

  // Post-commit read: the committed snapshot lives on the OrderImage rows, but
  // the customer-facing review page still reads the original SessionImage rows
  // (thumbnails, crops, positions) for display. Skip ACTIVE-only/expiry/context
  // validation here — none of them apply to a committed session, and abandoning
  // a CONVERTED row would violate the commit invariant.
  if (session.status === "CONVERTED") {
    return session;
  }

  if (session.status !== "ACTIVE" || session.expiresAt <= now) {
    if (session.status === "ACTIVE" && session.expiresAt <= now) {
      await prisma.orderSession.update({
        where: { id: session.id },
        data: { status: "ABANDONED" },
      });
    }
    clearSessionCookie(res);
    return null;
  }

  const contextOk = await validateOrderSessionContext(
    session.contextType,
    session.contextId,
  );
  if (!contextOk.ok) {
    await prisma.orderSession.update({
      where: { id: session.id },
      data: { status: "ABANDONED" },
    });
    clearSessionCookie(res);
    return null;
  }

  return session;
}

/** POST/DELETE: ACTIVE session, not expired, context valid. */
async function requireActiveSessionForMutation(
  req: Request,
  res: Response,
): Promise<OrderSession | null> {
  const sessionId = req.cookies?.[sessionConfig.cookieName] as string | undefined;

  if (!sessionId) {
    res.status(400).json({ error: "Session required" });
    return null;
  }

  const session = await prisma.orderSession.findUnique({
    where: { id: sessionId },
  });
  const now = new Date();

  if (!session) {
    clearSessionCookie(res);
    res.status(400).json({ error: "Session required" });
    return null;
  }

  if (session.status !== "ACTIVE") {
    clearSessionCookie(res);
    res.status(400).json({ error: "Session is not active" });
    return null;
  }

  if (session.expiresAt <= now) {
    await prisma.orderSession.update({
      where: { id: session.id },
      data: { status: "ABANDONED" },
    });
    clearSessionCookie(res);
    res.status(400).json({ error: "Session expired" });
    return null;
  }

  const contextOk = await validateOrderSessionContext(
    session.contextType,
    session.contextId,
  );
  if (!contextOk.ok) {
    await prisma.orderSession.update({
      where: { id: session.id },
      data: { status: "ABANDONED" },
    });
    clearSessionCookie(res);
    res.status(400).json({ error: "Context is no longer valid" });
    return null;
  }

  return session;
}

sessionImagesRouter.get("/", async (req, res) => {
  const session = await resolveActiveSessionForRead(req, res);
  if (!session) {
    res.json({ images: [], error: "SESSION_INVALID" });
    return;
  }

  const images = await prisma.sessionImage.findMany({
    where: { sessionId: session.id },
    orderBy: SESSION_IMAGE_LIST_ORDER_BY,
  });

  await prisma.orderSession.update({
    where: { id: session.id },
    data: { lastActiveAt: new Date() },
  });

  res.json({ images: images.map(serializeSessionImage) });
});

sessionImagesRouter.post(
  "/",
  (req, res, next) => {
    upload.array("files", MAX_MULTIPART_FILES_PER_REQUEST)(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(400).json({ error: "File too large (max 10MB)" });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }
      if (err) {
        next(err);
        return;
      }
      next();
    });
  },
  async (req, res) => {
    const session = await requireActiveSessionForMutation(req, res);
    if (!session) return;

    if (!session.selectedShapeId) {
      res.status(400).json({ error: "Select a shape before uploading photos" });
      return;
    }

    const allowedShape = await prisma.allowedShape.findFirst({
      where: {
        id: session.selectedShapeId,
        contextType: session.contextType,
        contextId: session.contextId,
      },
    });
    if (!allowedShape) {
      res.status(400).json({ error: "Selected shape is not valid" });
      return;
    }

    const files = req.files;
    if (!files || !Array.isArray(files) || files.length === 0) {
      res.status(400).json({ error: "No files uploaded" });
      return;
    }

    const maxAllowed = await getMaxImagesAllowed(session);
    if (maxAllowed == null) {
      res.status(400).json({
        error: "Complete pricing selection before uploading photos",
      });
      return;
    }

    const existingCount = await prisma.sessionImage.count({
      where: { sessionId: session.id },
    });
    if (existingCount + files.length > maxAllowed) {
      res.status(400).json({
        error: `You can upload up to ${maxAllowed} photos for this order`,
      });
      return;
    }

    const images: ApiSessionImage[] = [];
    const errors: { filename: string; error: string }[] = [];

    const minRequiredPx = getMinRequiredPx({
      shapeType: allowedShape.shapeType,
      widthMm: allowedShape.widthMm,
      heightMm: allowedShape.heightMm,
    });

    const maxPosAgg = await prisma.sessionImage.aggregate({
      where: { sessionId: session.id },
      _max: { position: true },
    });
    let nextPosition = (maxPosAgg._max.position ?? 0) + 1;

    for (const file of files) {
      const filename = file.originalname || "file";
      if (!isSessionUploadMime(file.mimetype)) {
        errors.push({
          filename,
          error: "Invalid file type (use JPG, PNG, or HEIC)",
        });
        continue;
      }
      if (file.size > SESSION_UPLOAD_MAX_BYTES) {
        errors.push({ filename, error: "File too large (max 10MB)" });
        continue;
      }

      const imageId = randomUUID();
      try {
        const { width, height } = await readImageDimensions(
          file.buffer,
          file.mimetype,
        );
        const isLowResolution =
          width < minRequiredPx || height < minRequiredPx;
        const { originalUrl } = await putSessionImageObject({
          sessionId: session.id,
          imageId,
          buffer: file.buffer,
          mimeType: file.mimetype,
        });

        const row = await prisma.sessionImage.create({
          data: {
            id: imageId,
            sessionId: session.id,
            originalUrl,
            width,
            height,
            fileSize: file.size,
            status: "UPLOADED",
            position: nextPosition,
            isLowResolution,
          },
        });
        nextPosition += 1;
        images.push(serializeSessionImage(row));
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Upload failed";
        errors.push({ filename, error: msg });
      }
    }

    await prisma.orderSession.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });

    res.json({
      images,
      ...(errors.length > 0 ? { errors } : {}),
    });
  },
);

sessionImagesRouter.patch("/:id", async (req, res) => {
  const session = await requireActiveSessionForMutation(req, res);
  if (!session) return;

  const { id } = req.params;
  if (!id || typeof id !== "string") {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const body = req.body as Record<string, unknown>;

  const cropX = body.cropX;
  const cropY = body.cropY;
  const cropWidth = body.cropWidth;
  const cropHeight = body.cropHeight;

  if (typeof cropX !== "number" || !Number.isFinite(cropX)) {
    res.status(400).json({ error: "cropX must be a finite number" });
    return;
  }
  if (typeof cropY !== "number" || !Number.isFinite(cropY)) {
    res.status(400).json({ error: "cropY must be a finite number" });
    return;
  }
  if (typeof cropWidth !== "number" || !Number.isFinite(cropWidth)) {
    res.status(400).json({ error: "cropWidth must be a finite number" });
    return;
  }
  if (typeof cropHeight !== "number" || !Number.isFinite(cropHeight)) {
    res.status(400).json({ error: "cropHeight must be a finite number" });
    return;
  }

  const row = await prisma.sessionImage.findFirst({
    where: { id, sessionId: session.id },
  });

  if (!row) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  if (row.width < 1 || row.height < 1) {
    res.status(400).json({ error: "Invalid stored image dimensions" });
    return;
  }

  const {
    cropX: cx,
    cropY: cy,
    cropWidth: cw,
    cropHeight: ch,
  } = clampCropRectToImage(row.width, row.height, cropX, cropY, cropWidth, cropHeight);

  if (!session.selectedShapeId) {
    res.status(400).json({ error: "Select a magnet shape before saving crop" });
    return;
  }

  const allowedShape = await prisma.allowedShape.findFirst({
    where: {
      id: session.selectedShapeId,
      contextType: session.contextType,
      contextId: session.contextId,
    },
  });
  if (!allowedShape) {
    res.status(400).json({ error: "Selected shape is not valid" });
    return;
  }

  const expectedRatio = expectedCropAspectRatio(allowedShape);
  const snapped = snapCropRectToShapeAspectRatio(
    row.width,
    row.height,
    cx,
    cy,
    cw,
    ch,
    expectedRatio,
  );
  if (!snapped) {
    res.status(400).json({
      error:
        "Crop cannot be matched to the selected magnet shape for this image size",
    });
    return;
  }

  const actualRatio = snapped.cropWidth / snapped.cropHeight;
  if (Math.abs(actualRatio - expectedRatio) > ASPECT_RATIO_TOLERANCE) {
    res.status(400).json({
      error: "Crop aspect ratio does not match selected magnet shape",
    });
    return;
  }

  const fx = snapped.cropX;
  const fy = snapped.cropY;
  const fw = snapped.cropWidth;
  const fh = snapped.cropHeight;

  const cs = body.cropScale;
  const ctx = body.cropTranslateX;
  const cty = body.cropTranslateY;
  const crot = body.cropRotation;

  const updated = await prisma.sessionImage.update({
    where: { id: row.id },
    data: {
      cropX: fx,
      cropY: fy,
      cropWidth: fw,
      cropHeight: fh,
      cropScale: typeof cs === "number" && Number.isFinite(cs) ? cs : null,
      cropTranslateX: typeof ctx === "number" && Number.isFinite(ctx) ? ctx : null,
      cropTranslateY: typeof cty === "number" && Number.isFinite(cty) ? cty : null,
      cropRotation:
        typeof crot === "number" && Number.isFinite(crot) ? crot : 0,
    },
  });

  await prisma.orderSession.update({
    where: { id: session.id },
    data: { lastActiveAt: new Date() },
  });

  res.json({ image: serializeSessionImage(updated) });
});

sessionImagesRouter.delete("/:id", async (req, res) => {
  const session = await requireActiveSessionForMutation(req, res);
  if (!session) return;

  const { id } = req.params;
  if (!id || typeof id !== "string") {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const row = await prisma.sessionImage.findFirst({
    where: { id, sessionId: session.id },
  });

  if (!row) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  await deleteSessionImageObject(row.originalUrl).catch((e) => {
    console.error("deleteSessionImageObject", e);
  });

  await prisma.sessionImage.delete({ where: { id: row.id } });

  await prisma.orderSession.update({
    where: { id: session.id },
    data: { lastActiveAt: new Date() },
  });

  res.json({ success: true });
});
