import { prisma } from "./prisma";
import { isSessionExpiredForMediaCleanup } from "./mediaRetention";
import {
  isDeletableSessionUploadUrl,
  safeDeleteSessionImageObject,
  sessionUploadBlobExists,
  tryRemoveEmptyLocalSessionUploadFolder,
  usesLocalSessionUploadStorage,
} from "./sessionImageStorage";

export type CleanupAbandonedSessionMediaOptions = {
  /** When true (default), only count files; no deletes. */
  dryRun?: boolean;
};

export type MediaCleanupError = {
  message: string;
  originalUrl?: string;
  sessionId?: string;
};

export type AbandonedSessionMediaSkippedReasons = {
  /** Candidate sessions (basic DB match) that fail the retention time window. */
  notPastRetention: number;
  /** Eligible sessions with no `SessionImage` rows. */
  noSessionImages: number;
  /** `SessionImage` rows (pending cleanup) with missing/empty URL or not passing `isDeletableSessionUploadUrl`. */
  unsafeOrMissingUrl: number;
};

/** `SessionImage` row counts per session (dry run only); pending cleanup rows only (`mediaDeletedAt IS NULL`). */
export type FilesFoundBySessionEntry = { sessionId: string; count: number };

export type CleanupAbandonedSessionMediaResult = {
  dryRun: boolean;
  sessionsScanned: number;
  sessionsEligible: number;
  /** Pending cleanup rows (`mediaDeletedAt IS NULL`) in eligible sessions. */
  filesFound: number;
  /** Non-dry-run only: blobs removed from storage this run (does not include already-missing). */
  filesDeleted: number;
  errors: MediaCleanupError[];
  totalCandidateSessions: number;
  sessionsPastRetention: number;
  /** Eligible sessions that have at least one `SessionImage` row (any `mediaDeletedAt`). */
  sessionsWithFiles: number;
  /** Pending cleanup rows with unsafe/deletable=false URLs. */
  filesSkipped: number;
  skippedReasons: AbandonedSessionMediaSkippedReasons;
  /** Rows in eligible sessions already marked cleaned (`mediaDeletedAt` set); skipped by cleanup. */
  filesAlreadyDeleted: number;
  /** Non-dry-run: blobs already absent before delete (rows still marked cleaned). */
  filesAlreadyMissing?: number;
  /** Local storage only: empty session dirs removed. */
  foldersDeleted?: number;
  /** Folder removal failures (best-effort; cleanup still succeeds). */
  folderCleanupErrors?: MediaCleanupError[];
  /** Present only when `dryRun` is true. */
  candidateSessionIds?: string[];
  /** Present only when `dryRun` is true. */
  eligibleSessionIds?: string[];
  /** Present only when `dryRun` is true. One row per eligible session (pending cleanup count). */
  filesFoundBySession?: FilesFoundBySessionEntry[];
};

/**
 * Deletes on-disk / S3 blobs for abandoned or expired order sessions past retention, across the whole DB.
 * - Only `ABANDONED` / `EXPIRED`, `orderId` null, not Stripe-`paid` (reconciliation orphans kept).
 * - Does not delete `OrderSession`, `SessionImage` rows, or order/print assets.
 * - Sets `SessionImage.mediaDeletedAt` when media is gone or successfully deleted (idempotent reruns).
 */
export async function cleanupAbandonedSessionMedia(
  options: CleanupAbandonedSessionMediaOptions = {},
): Promise<CleanupAbandonedSessionMediaResult> {
  const dryRun = options.dryRun !== false;
  const errors: MediaCleanupError[] = [];

  const now = new Date();
  /**
   * Unpaid, non-orphan candidates: `NOT (col ILIKE 'paid')` in SQL would drop rows where `col` IS NULL
   * (unknown NOT unknown → unknown). We must require explicitly: null OR not paid (case-insensitive).
   */
  const candidates = await prisma.orderSession.findMany({
    where: {
      status: { in: ["ABANDONED", "EXPIRED"] },
      orderId: null,
      OR: [
        { stripePaymentStatus: null },
        { NOT: { stripePaymentStatus: { equals: "paid", mode: "insensitive" } } },
      ],
    },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      lastActiveAt: true,
    },
  });

  const eligible = candidates.filter((s) => isSessionExpiredForMediaCleanup(s, now));
  const eligibleIds = eligible.map((s) => s.id);

  const [pendingImages, filesAlreadyDeleted, distinctSessionsWithAnyImage] =
    eligibleIds.length === 0
      ? [[], 0, [] as { sessionId: string }[]]
      : await Promise.all([
          prisma.sessionImage.findMany({
            where: {
              sessionId: { in: eligibleIds },
              mediaDeletedAt: null,
            },
            select: { id: true, originalUrl: true, sessionId: true },
          }),
          prisma.sessionImage.count({
            where: {
              sessionId: { in: eligibleIds },
              mediaDeletedAt: { not: null },
            },
          }),
          prisma.sessionImage.findMany({
            where: { sessionId: { in: eligibleIds } },
            select: { sessionId: true },
            distinct: ["sessionId"],
          }),
        ]);

  const images = pendingImages;
  const filesFound = images.length;

  const totalCandidateSessions = candidates.length;
  const sessionsPastRetention = eligible.length;
  const distinctWithImage = new Set(distinctSessionsWithAnyImage.map((r) => r.sessionId)).size;
  const sessionsWithFiles = distinctWithImage;

  let filesSkipped = 0;
  for (const img of images) {
    if (!isDeletableSessionUploadUrl(img.originalUrl)) {
      filesSkipped += 1;
    }
  }

  const skippedReasons: AbandonedSessionMediaSkippedReasons = {
    notPastRetention: totalCandidateSessions - sessionsPastRetention,
    noSessionImages: sessionsPastRetention - sessionsWithFiles,
    unsafeOrMissingUrl: filesSkipped,
  };

  const transparency = {
    totalCandidateSessions,
    sessionsPastRetention,
    sessionsWithFiles,
    filesSkipped,
    skippedReasons,
  };

  const fileCountBySession = new Map<string, number>();
  for (const i of images) {
    fileCountBySession.set(i.sessionId, (fileCountBySession.get(i.sessionId) ?? 0) + 1);
  }
  const dryRunDiagnostics = dryRun
    ? {
        candidateSessionIds: candidates.map((c) => c.id).sort(),
        eligibleSessionIds: eligible.map((e) => e.id).sort(),
        filesFoundBySession: eligible
          .map((e) => ({
            sessionId: e.id,
            count: fileCountBySession.get(e.id) ?? 0,
          }))
          .sort((a, b) => a.sessionId.localeCompare(b.sessionId)),
      }
    : {};

  console.info(
    `[media-cleanup] global dryRun=${dryRun} scanned=${candidates.length} eligible=${eligible.length} pendingFiles=${filesFound} alreadyMarked=${filesAlreadyDeleted}`,
  );

  if (dryRun) {
    for (const img of images) {
      if (!isDeletableSessionUploadUrl(img.originalUrl)) {
        errors.push({
          message: "URL not under session-images storage (skipped)",
          originalUrl: img.originalUrl,
          sessionId: img.sessionId,
        });
      }
    }
    return {
      dryRun,
      sessionsScanned: candidates.length,
      sessionsEligible: eligible.length,
      filesFound,
      filesDeleted: 0,
      errors,
      filesAlreadyDeleted,
      filesAlreadyMissing: 0,
      foldersDeleted: 0,
      ...transparency,
      ...dryRunDiagnostics,
    };
  }

  let filesDeleted = 0;
  let filesAlreadyMissing = 0;

  const deletedAt = now;

  for (const img of images) {
    if (!isDeletableSessionUploadUrl(img.originalUrl)) {
      errors.push({
        message: "URL not under session-images storage (skipped)",
        originalUrl: img.originalUrl,
        sessionId: img.sessionId,
      });
      continue;
    }

    let blobExisted = false;
    try {
      blobExisted = await sessionUploadBlobExists(img.originalUrl);
      if (blobExisted) {
        await safeDeleteSessionImageObject(img.originalUrl);
      }
      await prisma.sessionImage.update({
        where: { id: img.id },
        data: { mediaDeletedAt: deletedAt },
      });
      if (blobExisted) {
        filesDeleted += 1;
      } else {
        filesAlreadyMissing += 1;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({
        message,
        originalUrl: img.originalUrl,
        sessionId: img.sessionId,
      });
      console.warn("[media-cleanup] delete failed", img.sessionId, img.originalUrl, message);
    }
  }

  let foldersDeleted = 0;
  const folderCleanupErrors: MediaCleanupError[] = [];

  if (usesLocalSessionUploadStorage()) {
    for (const sid of eligibleIds) {
      const pending = await prisma.sessionImage.count({
        where: { sessionId: sid, mediaDeletedAt: null },
      });
      if (pending > 0) continue;

      const outcome = await tryRemoveEmptyLocalSessionUploadFolder(sid);
      if (outcome.removed) {
        foldersDeleted += 1;
      } else if (outcome.error) {
        folderCleanupErrors.push({
          message: outcome.error,
          sessionId: sid,
        });
      }
    }
  }

  console.info(
    `[media-cleanup] global completed deleted=${filesDeleted} alreadyMissing=${filesAlreadyMissing} foldersDeleted=${foldersDeleted} errors=${errors.length}`,
  );

  return {
    dryRun,
    sessionsScanned: candidates.length,
    sessionsEligible: eligible.length,
    filesFound,
    filesDeleted,
    errors,
    filesAlreadyDeleted,
    filesAlreadyMissing,
    foldersDeleted,
    ...(folderCleanupErrors.length > 0 ? { folderCleanupErrors } : {}),
    ...transparency,
  };
}

export {
  cleanupPrintSheets,
  type CleanupPrintSheetsOptions,
  type CleanupPrintSheetsResult,
  type PrintSheetCleanupError,
} from "./printSheetCleanup";

export {
  cleanupOrderMedia,
  type CleanupOrderMediaOptions,
  type CleanupOrderMediaResult,
  type FilesFoundByOrderEntry,
  type OrderMediaCleanupError,
} from "./orderMediaCleanup";
