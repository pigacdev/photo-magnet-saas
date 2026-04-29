import fs from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { PRINT_SHEET_RETENTION_HOURS } from "../config/mediaRetention";
import { s3Config } from "../config/s3";
import { getS3Client } from "./sessionImageStorage";

export type CleanupPrintSheetsOptions = {
  dryRun?: boolean;
};

export type PrintSheetCleanupError = {
  message: string;
  /** Local absolute path, when relevant */
  path?: string;
  /** S3 object key, when relevant */
  key?: string;
};

export type CleanupPrintSheetsResult = {
  dryRun: boolean;
  filesScanned: number;
  filesEligible: number;
  filesDeleted: number;
  /** PDFs scanned but still within retention window. */
  filesSkipped: number;
  errors: PrintSheetCleanupError[];
  retentionHours: number;
  oldestFileAt?: string | null;
  newestFileAt?: string | null;
};

const S3_PRINT_PREFIX = "print-sheets/";

function getLocalPrintSheetsRoot(): string {
  return path.resolve(process.cwd(), "uploads", "print-sheets");
}

/** Resolved file must be under local print-sheets root and end with `.pdf`. */
function isSafePdfUnderLocalPrintSheets(absResolved: string): boolean {
  const root = path.resolve(getLocalPrintSheetsRoot());
  const resolved = path.resolve(absResolved);
  const rel = path.relative(root, resolved);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return false;
  return resolved.toLowerCase().endsWith(".pdf");
}

async function collectLocalPdfEntries(rootDir: string): Promise<
  Array<{
    kind: "local";
    absPath: string;
    mtimeMs: number;
  }>
> {
  const out: Array<{ kind: "local"; absPath: string; mtimeMs: number }> = [];
  const rootResolved = path.resolve(rootDir);

  async function walk(dir: string): Promise<void> {
    let ents;
    try {
      ents = await fs.readdir(dir, { withFileTypes: true });
    } catch (e: unknown) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return;
      throw e;
    }

    for (const ent of ents) {
      const full = path.join(dir, ent.name);
      const resolvedChild = path.resolve(full);
      const relToRoot = path.relative(rootResolved, resolvedChild);
      if (
        resolvedChild !== rootResolved &&
        (relToRoot.startsWith("..") || path.isAbsolute(relToRoot))
      ) {
        continue;
      }

      if (ent.isDirectory()) {
        await walk(full);
      } else if (ent.isFile() && full.toLowerCase().endsWith(".pdf")) {
        const resolved = resolvedChild;
        if (!isSafePdfUnderLocalPrintSheets(resolved)) continue;
        const st = await fs.stat(resolved);
        out.push({ kind: "local", absPath: resolved, mtimeMs: st.mtimeMs });
      }
    }
  }

  await walk(rootResolved);
  return out;
}

function isS3HeadNotFound(e: unknown): boolean {
  const err = e as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  if (err.$metadata?.httpStatusCode === 404) return true;
  const n = err.name ?? err.Code ?? "";
  return n === "NotFound" || n === "NoSuchKey" || n === "NotFoundException";
}

async function listS3PrintSheetPdfs(): Promise<
  Array<{ kind: "s3"; key: string; lastModifiedMs: number }>
> {
  const bucket = s3Config.bucket?.trim();
  if (!bucket) return [];

  const client = getS3Client();
  const out: Array<{ kind: "s3"; key: string; lastModifiedMs: number }> = [];
  let continuationToken: string | undefined;

  do {
    const resp = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: S3_PRINT_PREFIX,
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of resp.Contents ?? []) {
      const key = obj.Key;
      if (!key || !obj.LastModified) continue;
      if (!key.toLowerCase().endsWith(".pdf")) continue;
      if (!key.startsWith(S3_PRINT_PREFIX)) continue;
      out.push({
        kind: "s3",
        key,
        lastModifiedMs: obj.LastModified.getTime(),
      });
    }

    continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (continuationToken);

  return out;
}

async function s3PdfExists(bucket: string, key: string): Promise<boolean> {
  const client = getS3Client();
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (e: unknown) {
    if (isS3HeadNotFound(e)) return false;
    throw e;
  }
}

async function pruneEmptyDirsUnderPrintSheetsRoot(absRoot: string): Promise<void> {
  async function walk(d: string): Promise<void> {
    let ents;
    try {
      ents = await fs.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }

    for (const ent of ents) {
      if (ent.isDirectory()) {
        await walk(path.join(d, ent.name));
      }
    }

    try {
      const rest = await fs.readdir(d);
      if (
        rest.length === 0 &&
        path.resolve(d) !== path.resolve(absRoot)
      ) {
        await fs.rmdir(d);
      }
    } catch {
      /* ignore ENOTEMPTY etc. */
    }
  }

  await walk(absRoot);
}

/**
 * Deletes generated print-sheet PDFs past {@link PRINT_SHEET_RETENTION_HOURS}.
 * Local: `uploads/print-sheets/**` (matches {@link generatePrintSheet} output layout).
 * S3: optional listing under prefix `print-sheets/` when `S3_BUCKET` is set.
 * Does not modify database rows.
 */
export async function cleanupPrintSheets(
  options: CleanupPrintSheetsOptions = {},
): Promise<CleanupPrintSheetsResult> {
  const dryRun = options.dryRun !== false;
  const retentionHours = PRINT_SHEET_RETENTION_HOURS;
  const cutoffMs = Date.now() - retentionHours * 60 * 60 * 1000;

  const errors: PrintSheetCleanupError[] = [];

  const localRoot = getLocalPrintSheetsRoot();
  let localEntries: Array<{ kind: "local"; absPath: string; mtimeMs: number }> = [];
  try {
    localEntries = await collectLocalPdfEntries(localRoot);
  } catch (e: unknown) {
    errors.push({
      message: e instanceof Error ? e.message : String(e),
      path: localRoot,
    });
  }

  let s3Entries: Array<{ kind: "s3"; key: string; lastModifiedMs: number }> = [];
  if (s3Config.bucket?.trim()) {
    try {
      s3Entries = await listS3PrintSheetPdfs();
    } catch (e: unknown) {
      errors.push({
        message:
          e instanceof Error ? e.message : String(e),
        key: S3_PRINT_PREFIX,
      });
      // TODO: recover partial listing if AWS SDK exposes continuation failures separately.
    }
  }

  type Unified =
    | { kind: "local"; absPath: string; mtimeMs: number }
    | { kind: "s3"; key: string; lastModifiedMs: number };

  const scanned: Unified[] = [...localEntries, ...s3Entries];

  const mtimesMs = scanned.map((s) =>
    s.kind === "local" ? s.mtimeMs : s.lastModifiedMs,
  );
  let oldestFileAt: string | null | undefined;
  let newestFileAt: string | null | undefined;
  if (mtimesMs.length > 0) {
    const min = Math.min(...mtimesMs);
    const max = Math.max(...mtimesMs);
    oldestFileAt = new Date(min).toISOString();
    newestFileAt = new Date(max).toISOString();
  } else {
    oldestFileAt = null;
    newestFileAt = null;
  }

  const eligible = scanned.filter((s) => {
    const t = s.kind === "local" ? s.mtimeMs : s.lastModifiedMs;
    return t < cutoffMs;
  });

  const filesScanned = scanned.length;
  const filesEligible = eligible.length;
  const filesSkipped = Math.max(0, filesScanned - filesEligible);

  if (dryRun) {
    console.info(
      `[print-sheet-cleanup] dryRun scanned=${filesScanned} eligible=${filesEligible} retentionHours=${retentionHours}`,
    );
    return {
      dryRun: true,
      filesScanned,
      filesEligible,
      filesDeleted: 0,
      filesSkipped,
      errors,
      retentionHours,
      oldestFileAt,
      newestFileAt,
    };
  }

  let filesDeleted = 0;

  const bucket = s3Config.bucket?.trim();

  for (const item of eligible) {
    if (item.kind === "local") {
      if (!isSafePdfUnderLocalPrintSheets(item.absPath)) {
        errors.push({
          message: "Refusing delete: path outside print-sheets root",
          path: item.absPath,
        });
        continue;
      }
      try {
        await fs.unlink(item.absPath);
        filesDeleted += 1;
      } catch (e: unknown) {
        const code = (e as NodeJS.ErrnoException).code;
        if (code === "ENOENT") {
          continue;
        }
        errors.push({
          message: e instanceof Error ? e.message : String(e),
          path: item.absPath,
        });
      }
      continue;
    }

    // S3
    if (!bucket) continue;
    try {
      const exists = await s3PdfExists(bucket, item.key);
      if (!exists) continue;

      await getS3Client().send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: item.key,
        }),
      );
      filesDeleted += 1;
    } catch (e: unknown) {
      errors.push({
        message: e instanceof Error ? e.message : String(e),
        key: item.key,
      });
    }
  }

  try {
    await pruneEmptyDirsUnderPrintSheetsRoot(localRoot);
  } catch (e: unknown) {
    errors.push({
      message: `Empty folder prune: ${e instanceof Error ? e.message : String(e)}`,
      path: localRoot,
    });
  }

  console.info(
    `[print-sheet-cleanup] completed deleted=${filesDeleted} scanned=${filesScanned} eligible=${filesEligible}`,
  );

  return {
    dryRun: false,
    filesScanned,
    filesEligible,
    filesDeleted,
    filesSkipped,
    errors,
    retentionHours,
    oldestFileAt,
    newestFileAt,
  };
}
