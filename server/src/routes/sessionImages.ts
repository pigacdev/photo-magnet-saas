/**
 * Session image uploads (Phase 5C): GET/POST/DELETE /api/session/images
 */
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { Router } from "express";
import multer from "multer";
import type { OrderSession } from "../../../src/generated/prisma/client";
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
import {
  MAX_MULTIPART_FILES_PER_REQUEST,
  SESSION_IMAGE_MIN_EDGE_PX,
} from "../../../src/lib/sessionImageLimits";
import { getMaxImagesAllowed } from "../lib/sessionImageMaxFromSession";

export const sessionImagesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: SESSION_UPLOAD_MAX_BYTES },
});

/** GET /images: list when session is ACTIVE (shape not required). */
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
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
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
          width < SESSION_IMAGE_MIN_EDGE_PX ||
          height < SESSION_IMAGE_MIN_EDGE_PX;
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
