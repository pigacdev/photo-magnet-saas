import { parseValidCustomerEmail } from "./parseOrderNotificationSettings";
import { sanitizeEmailHtml, plainTextLengthFromHtml } from "./sanitizeEmailHtml";

export const ORDER_EMAIL_MAX_ATTACHMENTS = 3;
export const ORDER_EMAIL_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ORDER_EMAIL_MAX_TOTAL_BYTES = 25 * 1024 * 1024;
export const ORDER_EMAIL_MIN_MESSAGE_CHARS = 10;
export const ORDER_EMAIL_MAX_SUBJECT_CHARS = 200;

const ALLOWED_ATTACHMENT_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".jpg",
  ".jpeg",
  ".png",
]);

function attachmentExtensionAllowed(filename: string): boolean {
  const lower = filename.toLowerCase();
  for (const ext of ALLOWED_ATTACHMENT_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

export type ParsedOrderEmailBody =
  | {
      ok: true;
      to: string;
      subject: string;
      messageHtml: string;
    }
  | { ok: false; error: string };

export function parseOrderEmailFormBody(body: Record<string, unknown>): ParsedOrderEmailBody {
  const toRaw = body.to;
  if (typeof toRaw !== "string") {
    return { ok: false, error: "Email is required" };
  }
  const emailParsed = parseValidCustomerEmail(toRaw);
  if (emailParsed.kind === "error") {
    return { ok: false, error: emailParsed.error };
  }

  const subjectRaw = typeof body.subject === "string" ? body.subject.trim() : "";
  if (!subjectRaw) {
    return { ok: false, error: "Subject is required" };
  }
  if (subjectRaw.length > ORDER_EMAIL_MAX_SUBJECT_CHARS) {
    return {
      ok: false,
      error: `Subject must be ${ORDER_EMAIL_MAX_SUBJECT_CHARS} characters or fewer`,
    };
  }

  const htmlRaw = typeof body.html === "string" ? body.html : "";
  const messageHtml = sanitizeEmailHtml(htmlRaw);
  if (plainTextLengthFromHtml(messageHtml) < ORDER_EMAIL_MIN_MESSAGE_CHARS) {
    return {
      ok: false,
      error: `Message must be at least ${ORDER_EMAIL_MIN_MESSAGE_CHARS} characters`,
    };
  }

  return {
    ok: true,
    to: emailParsed.value,
    subject: subjectRaw,
    messageHtml,
  };
}

export function sanitizeAttachmentFilename(name: string): string {
  const base = name.replace(/[^\w.\- ()]/g, "_").trim();
  return base.length > 0 ? base.slice(0, 200) : "attachment";
}

export function validateOrderEmailAttachments(
  files: Express.Multer.File[] | undefined,
):
  | { ok: true; attachments: { filename: string; content: Buffer }[] }
  | { ok: false; error: string } {
  const list = files ?? [];
  if (list.length > ORDER_EMAIL_MAX_ATTACHMENTS) {
    return {
      ok: false,
      error: `At most ${ORDER_EMAIL_MAX_ATTACHMENTS} attachments allowed`,
    };
  }

  let total = 0;
  const attachments: { filename: string; content: Buffer }[] = [];

  for (const file of list) {
    if (!file.size) {
      return { ok: false, error: "Empty attachment files are not allowed" };
    }
    if (
      !ALLOWED_ATTACHMENT_MIMES.has(file.mimetype) &&
      !attachmentExtensionAllowed(file.originalname)
    ) {
      return {
        ok: false,
        error: `Unsupported attachment type: ${file.originalname}`,
      };
    }
    total += file.size;
    if (total > ORDER_EMAIL_MAX_TOTAL_BYTES) {
      return { ok: false, error: "Combined attachment size exceeds 25 MB" };
    }
    attachments.push({
      filename: sanitizeAttachmentFilename(file.originalname),
      content: file.buffer,
    });
  }

  return { ok: true, attachments };
}
