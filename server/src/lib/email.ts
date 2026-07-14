import type { Prisma } from "../../../src/generated/prisma/client";
import { Resend } from "resend";
import { LEGAL_ENTITY } from "./legalConstants";

/** Order row + images for seller notification (image count only; no thumbnails in HTML). */
export type OrderForEmail = {
  id: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  shippingType: string | null;
  shippingAddress: Prisma.JsonValue | null;
  totalPrice: { toString(): string };
  currency: string;
  orderImages: readonly unknown[];
};

export type OrderForBuyerEmail = Omit<OrderForEmail, "orderImages"> & {
  pricingType: "PER_ITEM" | "BUNDLE";
  quantity: number | null;
  contextType: "EVENT" | "STOREFRONT";
  orderImages: readonly { copies: number }[];
};

const DEFAULT_FROM = "Magnetoo <onboarding@resend.dev>";

/** Hardcoded Resend test sender. See docs/PRODUCTION-TODOS.md before go-live. */
export const TEST_EMAIL_FROM = DEFAULT_FROM;

/** Hardcoded support inbox for testing. See docs/PRODUCTION-TODOS.md before go-live. */
export const SUPPORT_TICKET_TO = "magnetooprints@gmail.com";

/** Hardcoded support sender for testing. See docs/PRODUCTION-TODOS.md before go-live. */
export const SUPPORT_TICKET_FROM = TEST_EMAIL_FROM;

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/** Platform sender for Free/Hobby seller-context emails (not seller domain). */
export function platformFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM;
}

export type EmailBrandingOptions = {
  branded: boolean;
  contextName: string;
  organizationName: string | null;
  brandText?: string | null;
  bannerUrl?: string | null;
};

function buildEmailBrandingPrefix(branding?: EmailBrandingOptions): string {
  if (!branding?.branded) return "";
  const displayName = escapeHtml(
    branding.brandText?.trim() ||
      branding.organizationName?.trim() ||
      branding.contextName.trim() ||
      "Magnetoo",
  );
  const banner = branding.bannerUrl?.trim()
    ? `<img src="${escapeHtml(branding.bannerUrl.trim())}" alt="" width="120" style="display:block;max-height:48px;width:auto;margin-bottom:12px;border-radius:4px;" />`
    : "";
  return `${banner}<p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.02em;color:#374151;text-transform:uppercase;">${displayName}</p>`;
}

function buildEmailBrandingSuffix(branding?: EmailBrandingOptions): string {
  if (!branding?.branded) return "";
  const ctx = escapeHtml(
    branding.organizationName?.trim() ||
      branding.contextName.trim() ||
      "your shop",
  );
  return `<p style="margin:20px 0 0;font-size:12px;color:#9CA3AF;">Sent on behalf of ${ctx} via Magnetoo</p>`;
}

function defaultFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM;
}

export function buildOrderEmailSubject(
  order: Pick<OrderForEmail, "id">,
  contextName: string,
): string {
  const shortId = order.id.slice(0, 6).toUpperCase();

  return `📦 ${contextName} — New order received (#${shortId})`;
}

export function buildBuyerConfirmationSubject(): string {
  return "Confirmation of your purchase";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatStructuredAddressHtml(
  address: {
    street: string;
    houseNumber: string;
    city: string;
    postCode: string;
    country: string;
  },
): string {
  const line1 = [address.street, address.houseNumber].filter(Boolean).join(" ");
  const line2 = [address.postCode, address.city].filter(Boolean).join(" ");
  const parts = [line1, line2, address.country].filter(Boolean).map((p) =>
    escapeHtml(p),
  );
  return parts.length > 0 ? parts.join("<br/>") : "—";
}

function formatShippingAddressHtml(
  shippingAddress: Prisma.JsonValue | null,
): string {
  if (shippingAddress == null) {
    return "—";
  }
  if (typeof shippingAddress !== "object" || Array.isArray(shippingAddress)) {
    return escapeHtml(JSON.stringify(shippingAddress));
  }
  const o = shippingAddress as Record<string, unknown>;
  const street = typeof o.street === "string" ? o.street.trim() : "";
  const houseNumber =
    typeof o.houseNumber === "string" ? o.houseNumber.trim() : "";
  const city = typeof o.city === "string" ? o.city.trim() : "";
  const postCode = typeof o.postCode === "string" ? o.postCode.trim() : "";
  const country = typeof o.country === "string" ? o.country.trim() : "";
  if (street || houseNumber || city || postCode || country) {
    const line1 = [street, houseNumber].filter(Boolean).join(" ");
    const line2 = [postCode, city].filter(Boolean).join(" ");
    const parts = [line1, line2, country].filter(Boolean).map((p) =>
      escapeHtml(p),
    );
    return parts.join("<br/>");
  }
  if ("fullAddress" in o && typeof o.fullAddress === "string") {
    const notes =
      "notes" in o && typeof o.notes === "string" && o.notes.trim()
        ? `<br/><span style="color:#6B7280;font-size:13px;">${escapeHtml(o.notes)}</span>`
        : "";
    return `${escapeHtml(o.fullAddress)}${notes}`;
  }
  if ("lockerId" in o && typeof o.lockerId === "string") {
    return `Box now locker: <strong>${escapeHtml(o.lockerId)}</strong>`;
  }
  return escapeHtml(JSON.stringify(shippingAddress));
}

function formatMoney(totalPrice: { toString(): string }, currency: string): string {
  const n = Number(totalPrice.toString());
  const formatted = Number.isFinite(n) ? n.toFixed(2) : totalPrice.toString();
  return `${formatted} ${escapeHtml(currency)}`;
}

function buildDashboardOrderUrl(orderId: string): string {
  const base = (
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
  return `${base}/dashboard/orders/${orderId}`;
}

/**
 * Seller new-order notification — structured layout, no product images.
 * All user-facing strings are escaped for HTML.
 */
export function buildOrderEmailHtml(
  order: OrderForEmail,
  contextName: string,
  options?: {
    storefrontPickupAddress?: Prisma.JsonValue | null;
    branding?: EmailBrandingOptions;
  },
): string {
  const shortId = escapeHtml(order.id.slice(0, 6).toUpperCase());
  const ctx = escapeHtml(contextName);
  const name = order.customerName?.trim()
    ? escapeHtml(order.customerName.trim())
    : "—";
  const phone = order.customerPhone?.trim()
    ? escapeHtml(order.customerPhone.trim())
    : "—";

  const shipLine = order.shippingType?.trim()
    ? `<p style="margin:8px 0;"><strong>Shipping:</strong> ${escapeHtml(order.shippingType.trim())}</p>`
    : "";

  const addrHtml = formatShippingAddressHtml(order.shippingAddress);
  const showAddress =
    order.shippingAddress != null && addrHtml !== "—";
  const addressLine = showAddress
    ? `<p style="margin:8px 0;"><strong>Address:</strong><br/>${addrHtml}</p>`
    : "";

  const isPickup = order.shippingType?.trim().toLowerCase() === "pickup";
  const pickupAddr = options?.storefrontPickupAddress;
  const pickupLine =
    isPickup &&
    pickupAddr != null &&
    typeof pickupAddr === "object" &&
    !Array.isArray(pickupAddr)
      ? (() => {
          const o = pickupAddr as Record<string, unknown>;
          const html = formatStructuredAddressHtml({
            street: typeof o.street === "string" ? o.street.trim() : "",
            houseNumber:
              typeof o.houseNumber === "string" ? o.houseNumber.trim() : "",
            city: typeof o.city === "string" ? o.city.trim() : "",
            postCode: typeof o.postCode === "string" ? o.postCode.trim() : "",
            country: typeof o.country === "string" ? o.country.trim() : "",
          });
          return html !== "—"
            ? `<p style="margin:8px 0;"><strong>Pickup location:</strong><br/>${html}</p>`
            : "";
        })()
      : "";

  const images = String(order.orderImages.length);
  const total = formatMoney(order.totalPrice, order.currency);
  const orderUrl = escapeHtml(buildDashboardOrderUrl(order.id));
  const brandingPrefix = buildEmailBrandingPrefix(options?.branding);
  const brandingSuffix = buildEmailBrandingSuffix(options?.branding);

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f9fafb;">
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:auto;line-height:1.5;color:#111827;">

    ${brandingPrefix}
    <h2 style="margin:0 0 4px;font-size:20px;font-weight:600;">📦 New order received</h2>
    <p style="color:#666;margin:0;font-size:14px;">${ctx}</p>

    <div style="border:1px solid #eee;border-radius:8px;padding:16px;margin-top:16px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.04);">

      <p style="margin:8px 0;"><strong>Order:</strong> #${shortId}</p>
      <p style="margin:8px 0;"><strong>Name:</strong> ${name}</p>
      <p style="margin:8px 0;"><strong>Phone:</strong> ${phone}</p>

      ${shipLine}

      ${addressLine}
      ${pickupLine}

      <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />

      <p style="margin:8px 0;"><strong>Images:</strong> ${images}</p>
      <p style="margin:8px 0;"><strong>Total:</strong> ${total}</p>

    </div>

    <a href="${orderUrl}"
       style="display:inline-block;margin-top:16px;padding:12px 18px;background:#111;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;">
       View order
    </a>

    ${brandingSuffix}
  </div>
</body>
</html>`;
}

export function computeOrderMagnetCount(order: {
  pricingType: "PER_ITEM" | "BUNDLE";
  quantity: number | null;
  orderImages: readonly { copies: number }[];
}): number {
  if (order.pricingType === "BUNDLE") {
    return order.quantity ?? 0;
  }
  let total = 0;
  for (const img of order.orderImages) {
    total += img.copies >= 1 ? img.copies : 1;
  }
  return total;
}

/**
 * Buyer order confirmation — hello/thank-you plus order summary.
 */
export function buildBuyerConfirmationHtml(
  order: OrderForBuyerEmail,
  contextName: string,
  shapeLabelText: string,
  options?: {
    storefrontPickupAddress?: Prisma.JsonValue | null;
    branding?: EmailBrandingOptions;
  },
): string {
  const shortId = escapeHtml(order.id.slice(0, 6).toUpperCase());
  const ctx = escapeHtml(
    options?.branding?.organizationName?.trim() ||
      contextName.trim() ||
      "Magnetoo",
  );
  const greetingName = order.customerName?.trim()
    ? escapeHtml(order.customerName.trim())
    : "there";
  const shape = escapeHtml(shapeLabelText);
  const magnets = String(computeOrderMagnetCount(order));
  const photos = String(order.orderImages.length);
  const total = formatMoney(order.totalPrice, order.currency);

  const shipLine = order.shippingType?.trim()
    ? `<p style="margin:8px 0;"><strong>Shipping:</strong> ${escapeHtml(order.shippingType.trim())}</p>`
    : "";

  const addrHtml = formatShippingAddressHtml(order.shippingAddress);
  const showAddress =
    order.contextType === "STOREFRONT" &&
    order.shippingAddress != null &&
    addrHtml !== "—";
  const addressLine = showAddress
    ? `<p style="margin:8px 0;"><strong>Address:</strong><br/>${addrHtml}</p>`
    : "";

  const isPickup = order.shippingType?.trim().toLowerCase() === "pickup";
  const pickupAddr = options?.storefrontPickupAddress;
  const pickupLine =
    isPickup &&
    order.contextType === "STOREFRONT" &&
    pickupAddr != null &&
    typeof pickupAddr === "object" &&
    !Array.isArray(pickupAddr)
      ? (() => {
          const o = pickupAddr as Record<string, unknown>;
          const html = formatStructuredAddressHtml({
            street: typeof o.street === "string" ? o.street.trim() : "",
            houseNumber:
              typeof o.houseNumber === "string" ? o.houseNumber.trim() : "",
            city: typeof o.city === "string" ? o.city.trim() : "",
            postCode: typeof o.postCode === "string" ? o.postCode.trim() : "",
            country: typeof o.country === "string" ? o.country.trim() : "",
          });
          return html !== "—"
            ? `<p style="margin:8px 0;"><strong>Pickup location:</strong><br/>${html}</p>`
            : "";
        })()
      : "";

  const brandingPrefix = buildEmailBrandingPrefix(options?.branding);
  const brandingSuffix = buildEmailBrandingSuffix(options?.branding);

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f9fafb;">
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:auto;line-height:1.5;color:#111827;">

    ${brandingPrefix}
    <h2 style="margin:0 0 4px;font-size:20px;font-weight:600;">Confirmation of your purchase</h2>
    <p style="color:#666;margin:0;font-size:14px;">${ctx}</p>

    <p style="margin:16px 0 0;font-size:15px;">Hello ${greetingName},</p>
    <p style="margin:8px 0 0;font-size:15px;">Thank you for your purchase. Here are your order details:</p>

    <div style="border:1px solid #eee;border-radius:8px;padding:16px;margin-top:16px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.04);">

      <p style="margin:8px 0;"><strong>Order:</strong> #${shortId}</p>
      <p style="margin:8px 0;"><strong>Shape:</strong> ${shape}</p>
      <p style="margin:8px 0;"><strong>Magnets:</strong> ${magnets}</p>

      ${shipLine}
      ${addressLine}
      ${pickupLine}

      <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />

      <p style="margin:8px 0 0;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#6B7280;">Order summary</p>
      <p style="margin:8px 0;"><strong>Photos:</strong> ${photos}</p>
      <p style="margin:8px 0;"><strong>Total:</strong> ${total}</p>

    </div>

    <p style="margin:16px 0 0;font-size:14px;color:#374151;">You will receive your invoice shortly after we review your order.</p>

    <p style="margin:12px 0 0;font-size:14px;color:#6B7280;">If you have any questions, reply to this email.</p>

    ${brandingSuffix}
  </div>
</body>
</html>`;
}

export function buildSellerFromAddress(
  contextName: string,
  notificationEmail: string,
): string {
  const safeName = contextName.replace(/"/g, "").trim() || "Magnetoo";
  return `${safeName} <${notificationEmail}>`;
}

export type EmailAttachment = {
  filename: string;
  content: Buffer;
};

export function buildSellerToBuyerEmailHtml(data: {
  contextName: string;
  orderReference: string;
  messageHtml: string;
  branding?: EmailBrandingOptions;
}): string {
  const context = escapeHtml(
    data.branding?.organizationName?.trim() ||
      data.contextName.trim() ||
      "Magnetoo",
  );
  const ref = escapeHtml(data.orderReference.trim() || "—");
  const body = data.messageHtml.trim() || "<p></p>";
  const brandingPrefix = buildEmailBrandingPrefix(data.branding);
  const brandingSuffix = buildEmailBrandingSuffix(data.branding);

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f9fafb;">
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:auto;line-height:1.5;color:#111827;">

    ${brandingPrefix}
    <h2 style="margin:0 0 4px;font-size:20px;font-weight:600;">Message from ${context}</h2>
    <p style="color:#666;margin:0;font-size:14px;">Regarding order ${ref}</p>

    <div style="border:1px solid #eee;border-radius:8px;padding:16px;margin-top:16px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.04);font-size:15px;">
      ${body}
    </div>

    <p style="margin:16px 0 0;font-size:13px;color:#6B7280;">If you have any questions, reply to this email.</p>

    ${brandingSuffix}
  </div>
</body>
</html>`;
}

function appBaseUrl(): string {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function buildEmailLegalFooter(options?: {
  transactional?: boolean;
}): string {
  const privacyUrl = `${appBaseUrl()}/privacy`;
  const purpose = options?.transactional
    ? `<p style="margin:0 0 8px;font-size:12px;color:#6B7280;">This email was sent to fulfil your order (transactional).</p>`
    : "";
  return `${purpose}<p style="margin:16px 0 0;padding-top:12px;border-top:1px solid #e5e7eb;font-size:12px;color:#6B7280;line-height:1.5;">
    ${escapeHtml(LEGAL_ENTITY.name)} · ${escapeHtml(LEGAL_ENTITY.address)}<br/>
    <a href="mailto:${escapeHtml(LEGAL_ENTITY.contactEmail)}" style="color:#2563eb;">${escapeHtml(LEGAL_ENTITY.contactEmail)}</a>
    · <a href="${escapeHtml(privacyUrl)}" style="color:#2563eb;">Privacy Policy</a>
  </p>`;
}

function injectEmailLegalFooter(html: string, transactional?: boolean): string {
  const footer = buildEmailLegalFooter({ transactional });
  if (html.includes("</body>")) {
    return html.replace("</body>", `${footer}</body>`);
  }
  return `${html}${footer}`;
}

export async function sendEmail(data: {
  to: string;
  from?: string;
  replyTo?: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
  resendApiKey?: string;
  /** Skip legal footer (internal only). */
  skipLegalFooter?: boolean;
  transactional?: boolean;
  /** Marketing-adjacent: adds List-Unsubscribe header. */
  marketing?: boolean;
}): Promise<void> {
  const key = data.resendApiKey?.trim() || process.env.RESEND_API_KEY?.trim();
  if (!key) {
    console.warn("[email] Resend API key not set; skipping send");
    return;
  }

  const html = data.skipLegalFooter
    ? data.html
    : injectEmailLegalFooter(data.html, data.transactional ?? true);

  const resend = new Resend(key);
  const unsubscribeUrl = `${appBaseUrl()}/dashboard/settings?unsubscribe=1`;
  await resend.emails.send({
    from: data.from?.trim() || defaultFromAddress(),
    to: data.to,
    ...(data.replyTo?.trim() ? { replyTo: data.replyTo.trim() } : {}),
    subject: data.subject,
    html,
    ...(data.marketing
      ? {
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }
      : {}),
    ...(data.attachments?.length
      ? {
          attachments: data.attachments.map((a) => ({
            filename: a.filename,
            content: a.content,
          })),
        }
      : {}),
  });
}

export async function sendEmailWithTransport(
  transport: {
    resendApiKey: string;
    from: string;
    replyTo?: string;
  },
  data: {
    to: string;
    subject: string;
    html: string;
    attachments?: EmailAttachment[];
  },
): Promise<void> {
  await sendEmail({
    to: data.to,
    from: transport.from,
    replyTo: transport.replyTo,
    subject: data.subject,
    html: data.html,
    attachments: data.attachments,
    resendApiKey: transport.resendApiKey,
  });
}

export async function sendNewOrderEmail(
  transport: {
    resendApiKey: string;
    from: string;
  },
  data: {
    to: string;
    subject: string;
    html: string;
  },
): Promise<void> {
  await sendEmailWithTransport(transport, data);
}

export function buildSupportTicketSubject(
  contextSummary: string,
  sellerName: string | null,
  options?: { priority?: boolean },
): string {
  const who = sellerName?.trim() || "Seller";
  const base = `Support ticket — ${contextSummary} (${who})`;
  if (options?.priority) {
    return `PRIORITY — ${base}`;
  }
  return base;
}

export function buildSupportTicketHtml(data: {
  sellerName: string | null;
  sellerEmail: string;
  accountId?: string;
  contextSummary: string;
  message: string;
  submittedAt: Date;
  priority?: boolean;
}): string {
  const name = data.sellerName?.trim()
    ? escapeHtml(data.sellerName.trim())
    : "—";
  const email = escapeHtml(data.sellerEmail);
  const accountId = data.accountId ? escapeHtml(data.accountId) : null;
  const context = escapeHtml(data.contextSummary);
  const body = escapeHtml(data.message).replace(/\n/g, "<br/>");
  const when = escapeHtml(data.submittedAt.toISOString());

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f9fafb;">
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:auto;line-height:1.5;color:#111827;">

    <h2 style="margin:0 0 4px;font-size:20px;font-weight:600;">${
      data.priority ? "PRIORITY support ticket" : "New support ticket"
    }</h2>
    <p style="color:#666;margin:0;font-size:14px;">Submitted via Magnetoo dashboard${
      data.priority ? " · Pro plan (answer first)" : ""
    }</p>

    <div style="border:1px solid #eee;border-radius:8px;padding:16px;margin-top:16px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.04);">

      <p style="margin:8px 0;"><strong>Seller:</strong> ${name}</p>
      <p style="margin:8px 0;"><strong>Email:</strong> ${email}</p>
      ${accountId ? `<p style="margin:8px 0;"><strong>Account ID:</strong> ${accountId}</p>` : ""}
      <p style="margin:8px 0;"><strong>Context:</strong> ${context}</p>
      <p style="margin:8px 0;"><strong>Submitted:</strong> ${when}</p>

      <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />

      <p style="margin:8px 0 0;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#6B7280;">Message</p>
      <p style="margin:8px 0 0;font-size:15px;white-space:pre-wrap;">${body}</p>

    </div>

  </div>
</body>
</html>`;
}

export async function sendSupportTicketEmail(data: {
  replyTo: string;
  subject: string;
  html: string;
}): Promise<void> {
  await sendEmail({
    to: SUPPORT_TICKET_TO,
    from: SUPPORT_TICKET_FROM,
    replyTo: data.replyTo,
    subject: data.subject,
    html: data.html,
  });
}

function formatBillingDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function buildEarlyAccessHeadsUpHtml(data: {
  sellerName: string | null;
  expiresAt: Date;
  billingUrl: string;
}): string {
  const greeting = data.sellerName?.trim()
    ? escapeHtml(data.sellerName.trim())
    : "there";
  const expires = escapeHtml(formatBillingDate(data.expiresAt));
  const url = escapeHtml(data.billingUrl);

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f9fafb;">
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:auto;line-height:1.5;color:#111827;">
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;">Your early access ends soon</h2>
    <p style="margin:0 0 16px;color:#4b5563;font-size:15px;">Hi ${greeting},</p>
    <p style="margin:0 0 16px;font-size:15px;">Your 60-day free trial ends on <strong>${expires}</strong> (in about 7 days).</p>
    <p style="margin:0 0 16px;font-size:15px;">After that date Clerk will charge your card at the standard plan price unless you've already been moved to loyalty pricing.</p>
    <p style="margin:0 0 16px;font-size:15px;">You can review your plan anytime on the billing page:</p>
    <p style="margin:0;"><a href="${url}" style="color:#2563eb;text-decoration:underline;">${url}</a></p>
  </div>
</body>
</html>`;
}

export async function sendEarlyAccessHeadsUpEmail(data: {
  to: string;
  sellerName: string | null;
  expiresAt: Date;
  billingUrl: string;
}): Promise<void> {
  await sendEmail({
    to: data.to,
    from: platformFromAddress(),
    subject: "Your Magnetoo early access ends soon",
    html: buildEarlyAccessHeadsUpHtml(data),
    marketing: true,
    transactional: false,
  });
}

export function buildEarlyAccessExpiryHtml(data: {
  sellerName: string | null;
  newPlanLabel: string;
  hasLifetimeDiscount: boolean;
  billingUrl: string;
}): string {
  const greeting = data.sellerName?.trim()
    ? escapeHtml(data.sellerName.trim())
    : "there";
  const plan = escapeHtml(data.newPlanLabel);
  const url = escapeHtml(data.billingUrl);
  const discountNote = data.hasLifetimeDiscount
    ? " As a thank-you, your subscription includes our loyalty pricing."
    : "";

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f9fafb;">
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:auto;line-height:1.5;color:#111827;">
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;">Early access period ended</h2>
    <p style="margin:0 0 16px;color:#4b5563;font-size:15px;">Hi ${greeting},</p>
    <p style="margin:0 0 16px;font-size:15px;">Your 60-day free trial has ended. Your <strong>${plan}</strong> subscription continues at the standard price.${discountNote}</p>
    <p style="margin:0 0 16px;font-size:15px;">Billing is handled by Clerk — check your billing page for the next charge date.</p>
    <p style="margin:0;"><a href="${url}" style="color:#2563eb;text-decoration:underline;">View billing details</a> · ${url}</p>
  </div>
</body>
</html>`;
}

export async function sendEarlyAccessExpiryEmail(data: {
  to: string;
  sellerName: string | null;
  newPlanLabel: string;
  hasLifetimeDiscount: boolean;
  billingUrl: string;
}): Promise<void> {
  await sendEmail({
    to: data.to,
    from: platformFromAddress(),
    subject: "Your Magnetoo early access has ended",
    html: buildEarlyAccessExpiryHtml(data),
    marketing: true,
    transactional: false,
  });
}
