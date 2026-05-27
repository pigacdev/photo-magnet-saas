const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseValidCustomerEmail(
  raw: unknown,
): { kind: "error"; error: string } | { kind: "ok"; value: string } {
  if (typeof raw !== "string") {
    return { kind: "error", error: "Email is required" };
  }
  const t = raw.trim();
  if (t.length === 0) {
    return { kind: "error", error: "Email is required" };
  }
  if (!EMAIL_RE.test(t)) {
    return { kind: "error", error: "Invalid email address" };
  }
  return { kind: "ok", value: t };
}

export type ParseNotifResult<T> =
  | { kind: "omit" }
  | { kind: "ok"; value: T }
  | { kind: "error"; error: string };

export function parseNotificationEmailInput(
  raw: unknown,
): ParseNotifResult<string | null> {
  if (raw === undefined) return { kind: "omit" };
  if (raw === null) return { kind: "ok", value: null };
  if (typeof raw !== "string") {
    return { kind: "error", error: "notificationEmail must be a string or null" };
  }
  const t = raw.trim();
  if (t.length === 0) return { kind: "ok", value: null };
  if (!EMAIL_RE.test(t)) {
    return { kind: "error", error: "Invalid notification email" };
  }
  return { kind: "ok", value: t };
}

export function parseSendOrderEmailsInput(
  raw: unknown,
): ParseNotifResult<boolean> {
  if (raw === undefined) return { kind: "omit" };
  if (typeof raw !== "boolean") {
    return { kind: "error", error: "sendOrderEmails must be a boolean" };
  }
  return { kind: "ok", value: raw };
}
