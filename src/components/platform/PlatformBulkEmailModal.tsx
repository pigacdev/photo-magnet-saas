"use client";

import { useEffect, useState } from "react";
import { RichTextEditor, plainTextFromHtml } from "@/components/dashboard/RichTextEditor";
import {
  ORDER_EMAIL_MAX_SUBJECT_CHARS,
  ORDER_EMAIL_MIN_MESSAGE_CHARS,
} from "@/components/dashboard/SendOrderEmailModal";
import {
  sendPlatformNotification,
  type PlatformNotificationSelection,
} from "@/lib/platformApi";

export type PlatformBulkEmailModalProps = {
  open: boolean;
  recipientCount: number;
  selection: PlatformNotificationSelection;
  onClose: () => void;
  onSent: (result: {
    sent: number;
    skippedOptOut: number;
    failed: number;
    errors: string[];
  }) => void;
};

export function PlatformBulkEmailModal({
  open,
  recipientCount,
  selection,
  onClose,
  onSent,
}: PlatformBulkEmailModalProps) {
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("<p></p>");
  const [includeOptedOut, setIncludeOptedOut] = useState(false);
  const [step, setStep] = useState<"compose" | "confirm">("compose");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubject("");
    setHtml("<p></p>");
    setIncludeOptedOut(false);
    setStep("compose");
    setFormError(null);
    setSaving(false);
  }, [open]);

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

  const canContinue =
    subject.trim().length > 0 &&
    subject.trim().length <= ORDER_EMAIL_MAX_SUBJECT_CHARS &&
    messagePlainLength >= ORDER_EMAIL_MIN_MESSAGE_CHARS &&
    recipientCount > 0 &&
    !saving;

  if (!open) return null;

  async function handleSend() {
    if (!canContinue) return;
    setFormError(null);
    setSaving(true);
    try {
      const result = await sendPlatformNotification({
        subject: subject.trim(),
        html,
        includeOptedOut,
        selection,
      });
      onSent(result);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not send emails");
      setStep("compose");
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
        aria-labelledby="platform-bulk-email-title"
        className="relative flex h-[min(92vh,880px)] w-full max-w-3xl flex-col overflow-hidden rounded-t-xl border border-border bg-background shadow-xl sm:rounded-xl"
      >
        <div className="shrink-0 border-b border-border px-4 py-3 sm:px-6">
          <h2
            id="platform-bulk-email-title"
            className="text-base font-semibold text-foreground sm:text-lg"
          >
            Email selected sellers
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Send a platform notification to {recipientCount} selected seller
            {recipientCount === 1 ? "" : "s"} via Resend.
          </p>
        </div>

        {step === "compose" ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6">
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
                  placeholder="System maintenance notice"
                  className="min-h-[44px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-primary focus:ring-2 disabled:opacity-60"
                />
              </label>

              <div className="flex min-h-[280px] flex-1 flex-col gap-1.5 sm:min-h-[320px]">
                <span className="shrink-0 text-sm font-medium text-foreground">
                  Message
                </span>
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

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface/50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={includeOptedOut}
                  onChange={(e) => setIncludeOptedOut(e.target.checked)}
                  disabled={saving}
                  className="mt-0.5 size-4 shrink-0 rounded border-border"
                />
                <span className="text-sm text-foreground">
                  <span className="font-medium">
                    Include sellers who opted out of marketing
                  </span>
                  <span className="mt-1 block text-muted-foreground">
                    Enable for critical notices (outages, security). When off,
                    sellers who opted out of marketing emails are skipped.
                  </span>
                </span>
              </label>

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
                type="button"
                disabled={!canContinue}
                onClick={() => {
                  setFormError(null);
                  setStep("confirm");
                }}
                className="min-h-[44px] rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-50"
              >
                Review & send
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6">
              <p className="text-sm text-muted-foreground">
                Please confirm before sending this email.
              </p>
              <dl className="space-y-3 rounded-lg border border-border bg-surface/50 px-4 py-3 text-sm">
                <div>
                  <dt className="font-medium text-muted-foreground">Recipients</dt>
                  <dd className="mt-1 text-foreground tabular-nums">
                    {recipientCount} seller{recipientCount === 1 ? "" : "s"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Subject</dt>
                  <dd className="mt-1 text-foreground">{subject.trim()}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">
                    Marketing opt-out
                  </dt>
                  <dd className="mt-1 text-foreground">
                    {includeOptedOut
                      ? "Include opted-out sellers (transactional)"
                      : "Skip sellers who opted out of marketing"}
                  </dd>
                </div>
              </dl>
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
                onClick={() => setStep("compose")}
                className="min-h-[44px] rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => void handleSend()}
                className="min-h-[44px] rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-50"
              >
                {saving ? "Sending…" : "Send email"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
