"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFormData } from "@/lib/api";
import { RichTextEditor, plainTextFromHtml } from "@/components/dashboard/RichTextEditor";

export const ORDER_EMAIL_MAX_ATTACHMENTS = 3;
export const ORDER_EMAIL_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ORDER_EMAIL_MAX_TOTAL_BYTES = 25 * 1024 * 1024;
export const ORDER_EMAIL_MIN_MESSAGE_CHARS = 10;
export const ORDER_EMAIL_MAX_SUBJECT_CHARS = 200;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_ATTACHMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
];

const ACCEPT_EXTENSIONS = ".pdf,.doc,.docx,.jpg,.jpeg,.png";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type SendOrderEmailModalProps = {
  open: boolean;
  orderId: string;
  orderReference: string;
  customerEmail: string | null;
  saving?: boolean;
  onClose: () => void;
  onSent: () => void;
};

export function SendOrderEmailModal({
  open,
  orderId,
  orderReference,
  customerEmail,
  onClose,
  onSent,
}: SendOrderEmailModalProps) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("<p></p>");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultSubject = useMemo(
    () => `Regarding your order ${orderReference}`,
    [orderReference],
  );

  useEffect(() => {
    if (!open) return;
    setTo(customerEmail?.trim() ?? "");
    setSubject(defaultSubject);
    setHtml("<p></p>");
    setAttachments([]);
    setFormError(null);
    setSaving(false);
  }, [open, customerEmail, defaultSubject]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, saving, onClose]);

  const messagePlainLength = plainTextFromHtml(html).length;
  const totalAttachmentBytes = attachments.reduce((sum, f) => sum + f.size, 0);

  const canSend =
    EMAIL_RE.test(to.trim()) &&
    subject.trim().length > 0 &&
    subject.trim().length <= ORDER_EMAIL_MAX_SUBJECT_CHARS &&
    messagePlainLength >= ORDER_EMAIL_MIN_MESSAGE_CHARS &&
    attachments.length <= ORDER_EMAIL_MAX_ATTACHMENTS &&
    attachments.every((f) => ALLOWED_ATTACHMENT_TYPES.includes(f.type)) &&
    attachments.every((f) => f.size > 0 && f.size <= ORDER_EMAIL_MAX_FILE_BYTES) &&
    totalAttachmentBytes <= ORDER_EMAIL_MAX_TOTAL_BYTES &&
    !saving;

  if (!open) return null;

  function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setFormError(null);
    const next = [...attachments];
    for (const file of Array.from(fileList)) {
      if (next.length >= ORDER_EMAIL_MAX_ATTACHMENTS) {
        setFormError(`At most ${ORDER_EMAIL_MAX_ATTACHMENTS} attachments allowed`);
        break;
      }
      if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
        setFormError(`Unsupported file type: ${file.name}`);
        continue;
      }
      if (file.size <= 0) {
        setFormError(`Empty file: ${file.name}`);
        continue;
      }
      if (file.size > ORDER_EMAIL_MAX_FILE_BYTES) {
        setFormError(`${file.name} exceeds 10 MB`);
        continue;
      }
      const combined = next.reduce((s, f) => s + f.size, 0) + file.size;
      if (combined > ORDER_EMAIL_MAX_TOTAL_BYTES) {
        setFormError("Combined attachment size exceeds 25 MB");
        break;
      }
      next.push(file);
    }
    setAttachments(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setFormError(null);
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("to", to.trim());
      fd.append("subject", subject.trim());
      fd.append("html", html);
      for (const file of attachments) {
        fd.append("attachments", file);
      }
      await apiFormData(`/api/orders/${encodeURIComponent(orderId)}/send-email`, fd);
      onSent();
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not send email");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        onClick={() => {
          if (!saving) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-order-email-title"
        className="relative flex h-[min(92vh,880px)] w-full max-w-3xl flex-col overflow-hidden rounded-t-xl border border-border bg-background shadow-xl sm:rounded-xl"
      >
        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-border px-4 py-3 sm:px-6">
            <h2
              id="send-order-email-title"
              className="text-base font-semibold text-foreground sm:text-lg"
            >
              Send email
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Email the customer about order {orderReference}.
            </p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6">
            <label className="flex shrink-0 flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Email To</span>
              <input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                disabled={saving}
                autoComplete="email"
                placeholder="customer@example.com"
                className="min-h-[44px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-primary focus:ring-2 disabled:opacity-60"
              />
            </label>

            <label className="flex shrink-0 flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Subject</span>
              <input
                type="text"
                value={subject}
                onChange={(e) =>
                  setSubject(e.target.value.slice(0, ORDER_EMAIL_MAX_SUBJECT_CHARS))
                }
                disabled={saving}
                maxLength={ORDER_EMAIL_MAX_SUBJECT_CHARS}
                className="min-h-[44px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-primary focus:ring-2 disabled:opacity-60"
              />
            </label>

            <div className="flex min-h-[280px] flex-1 flex-col gap-1.5 sm:min-h-[320px]">
              <span className="shrink-0 text-sm font-medium text-foreground">Message</span>
              <RichTextEditor
                value={html}
                onChange={setHtml}
                disabled={saving}
                variant="large"
              />
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {messagePlainLength}/{ORDER_EMAIL_MIN_MESSAGE_CHARS} min characters
              </span>
            </div>

            <div className="flex shrink-0 flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">Attachments</span>
                <span className="text-xs text-muted-foreground">
                  PDF, Word, JPG, PNG · max 10 MB each
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_EXTENSIONS}
                multiple
                disabled={saving || attachments.length >= ORDER_EMAIL_MAX_ATTACHMENTS}
                className="text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-50"
                onChange={(e) => addFiles(e.target.files)}
              />
              {attachments.length > 0 ? (
                <ul className="space-y-2">
                  {attachments.map((file, index) => (
                    <li
                      key={`${file.name}-${file.size}-${index}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate text-foreground">{file.name}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatBytes(file.size)}
                        </span>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => removeAttachment(index)}
                          className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Optional — attach an invoice or other document.
                </p>
              )}
            </div>

            {formError ? (
              <p className="text-sm text-red-600" role="alert">
                {formError}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="min-h-[44px] rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSend}
              className="min-h-[44px] rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-50"
            >
              {saving ? "Sending…" : "Send email"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
