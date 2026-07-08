"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/auth";
import { api } from "@/lib/api";
import { normalizeOrderReference } from "@/lib/orderReference";

const MIN_MESSAGE_LENGTH = 20;
const MAX_MESSAGE_LENGTH = 5000;
const DRAFT_STORAGE_KEY = "magnetoo-support-ticket-draft";

type SupportContextType = "GENERAL" | "EVENT" | "STOREFRONT" | "ORDER";

type ContextOption = "general" | "event" | "storefront" | "order";

type OrderContextsResponse = {
  events: { id: string; name: string }[];
  storefronts: { id: string; name: string }[];
};

type FormDraft = {
  contextOption: ContextOption;
  contextId: string;
  orderId: string;
  message: string;
};

export type SupportTicketInitialContext = {
  contextType?: SupportContextType;
  contextId?: string;
  orderId?: string;
};

export type SupportTicketFormProps = {
  user: User;
  initialContext?: SupportTicketInitialContext;
};

function contextOptionFromType(
  type: SupportContextType | undefined,
): ContextOption {
  switch (type) {
    case "EVENT":
      return "event";
    case "STOREFRONT":
      return "storefront";
    case "ORDER":
      return "order";
    default:
      return "general";
  }
}

function contextTypeFromOption(option: ContextOption): SupportContextType {
  switch (option) {
    case "event":
      return "EVENT";
    case "storefront":
      return "STOREFRONT";
    case "order":
      return "ORDER";
    default:
      return "GENERAL";
  }
}

function readDraft(): FormDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FormDraft>;
    if (
      parsed.contextOption !== "general" &&
      parsed.contextOption !== "event" &&
      parsed.contextOption !== "storefront" &&
      parsed.contextOption !== "order"
    ) {
      return null;
    }
    return {
      contextOption: parsed.contextOption,
      contextId: typeof parsed.contextId === "string" ? parsed.contextId : "",
      orderId: typeof parsed.orderId === "string" ? parsed.orderId : "",
      message: typeof parsed.message === "string" ? parsed.message : "",
    };
  } catch {
    return null;
  }
}

function writeDraft(draft: FormDraft): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

function clearDraft(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(DRAFT_STORAGE_KEY);
}

const ORDER_AMBIGUOUS_ERROR =
  "That reference matches more than one order. Paste the full order id from the order page.";

function fieldInputClass(hasError: boolean): string {
  return `mt-1.5 block w-full rounded-lg border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 ${
    hasError
      ? "border-red-300 ring-red-200 focus:ring-red-200"
      : "border-border focus:border-primary focus:ring-primary"
  }`;
}

function FieldHint({
  error,
  id,
}: {
  error?: string;
  id?: string;
}) {
  if (!error) return null;
  return (
    <p id={id} className="mt-1 text-xs text-red-600" role="alert">
      {error}
    </p>
  );
}

function isOrderIdFieldError(message: string): boolean {
  return message === "Order not found" || message === ORDER_AMBIGUOUS_ERROR;
}

function buildInitialState(initialContext?: SupportTicketInitialContext): FormDraft {
  const draft = readDraft();
  const fromUrl = Boolean(
    initialContext?.contextType ||
      initialContext?.contextId ||
      initialContext?.orderId,
  );

  if (fromUrl) {
    return {
      contextOption: contextOptionFromType(initialContext?.contextType),
      contextId: initialContext?.contextId ?? draft?.contextId ?? "",
      orderId: initialContext?.orderId ?? draft?.orderId ?? "",
      message: draft?.message ?? "",
    };
  }

  return {
    contextOption: draft?.contextOption ?? "general",
    contextId: draft?.contextId ?? "",
    orderId: draft?.orderId ?? "",
    message: draft?.message ?? "",
  };
}

export function SupportTicketForm({
  user,
  initialContext,
}: SupportTicketFormProps) {
  const router = useRouter();
  const [initial] = useState(() => buildInitialState(initialContext));
  const [contextOption, setContextOption] = useState(initial.contextOption);
  const [contextId, setContextId] = useState(initial.contextId);
  const [orderId, setOrderId] = useState(initial.orderId);
  const [message, setMessage] = useState(initial.message);
  const [contexts, setContexts] = useState<OrderContextsResponse | null>(null);
  const [contextsLoading, setContextsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [orderIdError, setOrderIdError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setContextsLoading(true);
    api<OrderContextsResponse>("/api/orders/contexts")
      .then((data) => setContexts(data))
      .catch(() => setContexts({ events: [], storefronts: [] }))
      .finally(() => setContextsLoading(false));
  }, []);

  useEffect(() => {
    if (submitted) return;
    writeDraft({ contextOption, contextId, orderId, message });
  }, [contextOption, contextId, orderId, message, submitted]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOrderIdError("");

    const trimmedMessage = message.trim();
    if (trimmedMessage.length < MIN_MESSAGE_LENGTH) {
      setError(`Message must be at least ${MIN_MESSAGE_LENGTH} characters`);
      return;
    }

    const contextType = contextTypeFromOption(contextOption);
    const normalizedOrderId = normalizeOrderReference(orderId);

    if (contextOption === "event" || contextOption === "storefront") {
      if (!contextId.trim()) {
        setError("Please select a context");
        return;
      }
    }

    if (contextOption === "order" && !normalizedOrderId) {
      setOrderIdError("Order id is required");
      return;
    }

    setSubmitting(true);
    try {
      await api("/api/support/tickets", {
        method: "POST",
        body: {
          contextType,
          ...(contextOption === "event" || contextOption === "storefront"
            ? { contextId: contextId.trim() }
            : {}),
          ...(contextOption === "order"
            ? { orderId: normalizedOrderId }
            : {}),
          message: trimmedMessage,
        },
      });
      clearDraft();
      setSubmitted(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to submit ticket";
      if (contextOption === "order" && isOrderIdFieldError(message)) {
        setOrderIdError(message);
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <section className="dashboard-card border border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
        <h2 className="text-lg font-semibold text-green-800 dark:text-green-300">
          Support ticket submitted successfully
        </h2>
        <p className="mt-2 text-sm text-green-800/90 dark:text-green-300/90">
          We received your message and will reply to{" "}
          <span className="font-medium">{user.email}</span> as soon as possible.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
        >
          Back to dashboard
        </Link>
      </section>
    );
  }

  const contextSelectValue =
    contextOption === "event"
      ? `EVENT:${contextId}`
      : contextOption === "storefront"
        ? `STOREFRONT:${contextId}`
        : "";

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="dashboard-card space-y-6">
      <div>
        <label
          htmlFor="contextType"
          className="block text-sm font-medium text-foreground"
        >
          Context
        </label>
        <select
          id="contextType"
          value={contextOption}
          onChange={(e) => {
            const next = e.target.value as ContextOption;
            setContextOption(next);
            setContextId("");
            setOrderId("");
            setError("");
            setOrderIdError("");
          }}
          className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
        >
          <option value="general">General</option>
          <option value="event">Event</option>
          <option value="storefront">Storefront</option>
          <option value="order">Order</option>
        </select>
      </div>

      {(contextOption === "event" || contextOption === "storefront") && (
        <div>
          <label
            htmlFor="contextSelect"
            className="block text-sm font-medium text-foreground"
          >
            {contextOption === "event" ? "Event" : "Storefront"}
          </label>
          <select
            id="contextSelect"
            required
            disabled={contextsLoading}
            value={contextSelectValue}
            onChange={(e) => {
              const value = e.target.value;
              if (!value) {
                setContextId("");
                return;
              }
              const colon = value.indexOf(":");
              setContextId(colon >= 0 ? value.slice(colon + 1) : "");
            }}
            className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-60"
          >
            <option value="">
              {contextsLoading ? "Loading…" : "Select…"}
            </option>
            {contextOption === "event" &&
              contexts?.events.map((ev) => (
                <option key={ev.id} value={`EVENT:${ev.id}`}>
                  {ev.name}
                </option>
              ))}
            {contextOption === "storefront" &&
              contexts?.storefronts.map((sf) => (
                <option key={sf.id} value={`STOREFRONT:${sf.id}`}>
                  {sf.name}
                </option>
              ))}
          </select>
        </div>
      )}

      {contextOption === "order" && (
        <div>
          <label
            htmlFor="orderId"
            className="block text-sm font-medium text-foreground"
          >
            Order ID
          </label>
          <input
            id="orderId"
            type="text"
            required
            value={orderId}
            aria-invalid={Boolean(orderIdError)}
            aria-describedby={orderIdError ? "orderId-error" : undefined}
            onChange={(e) => {
              setOrderId(e.target.value);
              if (orderIdError) setOrderIdError("");
            }}
            placeholder="Order reference or UUID"
            className={fieldInputClass(Boolean(orderIdError))}
          />
          <FieldHint error={orderIdError} id="orderId-error" />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Paste the value from{" "}
            <span className="font-medium">Copy reference</span> on the order
            page, or find your order on the{" "}
            <Link href="/dashboard/orders" className="text-primary hover:underline">
              Orders
            </Link>{" "}
            page.
          </p>
        </div>
      )}

      <div>
        <label
          htmlFor="message"
          className="block text-sm font-medium text-foreground"
        >
          Message
        </label>
        <textarea
          id="message"
          required
          rows={6}
          value={message}
          onChange={(e) =>
            setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))
          }
          placeholder="Describe your issue or question…"
          disabled={submitting}
          className="mt-1.5 block w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-60"
        />
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          {message.length}/{MAX_MESSAGE_LENGTH} (minimum {MIN_MESSAGE_LENGTH})
        </p>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground">Your email</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{user.email}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Replies will be sent to this address.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            if (window.history.length > 1) {
              router.back();
            } else {
              router.push("/dashboard");
            }
          }}
          className="min-h-[44px] rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="min-h-[44px] rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit ticket"}
        </button>
      </div>
    </form>
  );
}
