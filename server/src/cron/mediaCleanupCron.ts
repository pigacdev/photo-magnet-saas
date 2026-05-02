import cron from "node-cron";
import type { CleanupAbandonedSessionMediaResult } from "../lib/mediaCleanup";
import {
  cleanupAbandonedSessionMedia,
  cleanupOrderMedia,
  cleanupPrintSheets,
  type CleanupOrderMediaResult,
  type CleanupPrintSheetsResult,
} from "../lib/mediaCleanup";

type CleanupJobResult = {
  dryRun: boolean;
  errors: readonly { message?: string }[];
};

function summarizeAbandonedSession(
  r: CleanupAbandonedSessionMediaResult,
): Record<string, unknown> {
  const o: Record<string, unknown> = {
    sessionsScanned: r.sessionsScanned,
    sessionsEligible: r.sessionsEligible,
    sessionsWithFiles: r.sessionsWithFiles,
    filesFound: r.filesFound,
    filesDeleted: r.filesDeleted,
    filesSkipped: r.filesSkipped,
  };
  if (r.filesAlreadyMissing !== undefined) {
    o.filesAlreadyMissing = r.filesAlreadyMissing;
  }
  return o;
}

function summarizePrintSheets(
  r: CleanupPrintSheetsResult,
): Record<string, unknown> {
  return {
    filesScanned: r.filesScanned,
    filesEligible: r.filesEligible,
    filesDeleted: r.filesDeleted,
    filesSkipped: r.filesSkipped,
    retentionHours: r.retentionHours,
  };
}

function summarizeOrderMedia(r: CleanupOrderMediaResult): Record<string, unknown> {
  return {
    ordersScanned: r.ordersScanned,
    ordersEligible: r.ordersEligible,
    orderImagesFound: r.orderImagesFound,
    filesFound: r.filesFound,
    filesDeleted: r.filesDeleted,
    filesAlreadyMissing: r.filesAlreadyMissing,
    filesSkipped: r.filesSkipped ?? 0,
    orderImagesMarkedDeleted: r.orderImagesMarkedDeleted,
    foldersDeleted: r.foldersDeleted,
    retentionDays: r.retentionDays,
  };
}

async function runJob<R extends CleanupJobResult>(
  name: string,
  fn: () => Promise<R>,
  summarize: (r: R) => Record<string, unknown>,
): Promise<void> {
  const startedAt = new Date();
  console.log(`[cron] ${name} started at`, startedAt.toISOString());

  try {
    const result = await fn();
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const errorsCount = result.errors.length;
    const firstMsg = result.errors[0]?.message;
    console.log(`[cron] ${name} completed`, {
      job: name,
      success: true,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
      dryRun: result.dryRun,
      ...summarize(result),
      errorsCount,
      ...(errorsCount > 0 && firstMsg !== undefined && firstMsg !== ""
        ? { firstErrorMessage: firstMsg }
        : {}),
    });
  } catch (err) {
    console.error(`[cron] ${name} failed`, err);
  }
}

const ENABLE_CRON = process.env.ENABLE_MEDIA_CLEANUP_CRON === "true";

if (!ENABLE_CRON) {
  console.log("[cron] media cleanup cron is disabled");
} else {
  // Every hour
  cron.schedule("0 * * * *", () => {
    void runJob("cleanup-abandoned-sessions", () =>
      cleanupAbandonedSessionMedia({ dryRun: false }),
      summarizeAbandonedSession,
    );
  });

  // Every 3 hours
  cron.schedule("0 */3 * * *", () => {
    void runJob("cleanup-print-sheets", () =>
      cleanupPrintSheets({ dryRun: false }),
      summarizePrintSheets,
    );
  });

  // Once per day at 03:00
  cron.schedule("0 3 * * *", () => {
    void runJob("cleanup-order-media", () =>
      cleanupOrderMedia({ dryRun: false }),
      summarizeOrderMedia,
    );
  });
}
