import type { Prisma } from "../../../src/generated/prisma/client";
import { Resend } from "resend";

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

  const images = String(order.orderImages.length);
  const total = formatMoney(order.totalPrice, order.currency);
  const orderUrl = escapeHtml(buildDashboardOrderUrl(order.id));

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f9fafb;">
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:auto;line-height:1.5;color:#111827;">

    <h2 style="margin:0 0 4px;font-size:20px;font-weight:600;">📦 New order received</h2>
    <p style="color:#666;margin:0;font-size:14px;">${ctx}</p>

    <div style="border:1px solid #eee;border-radius:8px;padding:16px;margin-top:16px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.04);">

      <p style="margin:8px 0;"><strong>Order:</strong> #${shortId}</p>
      <p style="margin:8px 0;"><strong>Name:</strong> ${name}</p>
      <p style="margin:8px 0;"><strong>Phone:</strong> ${phone}</p>

      ${shipLine}

      ${addressLine}

      <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />

      <p style="margin:8px 0;"><strong>Images:</strong> ${images}</p>
      <p style="margin:8px 0;"><strong>Total:</strong> ${total}</p>

    </div>

    <a href="${orderUrl}"
       style="display:inline-block;margin-top:16px;padding:12px 18px;background:#111;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;">
       View order
    </a>

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
): string {
  const shortId = escapeHtml(order.id.slice(0, 6).toUpperCase());
  const ctx = escapeHtml(contextName);
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

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f9fafb;">
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:auto;line-height:1.5;color:#111827;">

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

      <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />

      <p style="margin:8px 0 0;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#6B7280;">Order summary</p>
      <p style="margin:8px 0;"><strong>Photos:</strong> ${photos}</p>
      <p style="margin:8px 0;"><strong>Total:</strong> ${total}</p>

    </div>

    <p style="margin:16px 0 0;font-size:14px;color:#374151;">You will receive your invoice shortly after we review your order.</p>

    <p style="margin:12px 0 0;font-size:14px;color:#6B7280;">If you have any questions, reply to this email.</p>

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

export async function sendEmail(data: {
  to: string;
  from?: string;
  replyTo?: string;
  subject: string;
  html: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    console.warn("[email] RESEND_API_KEY not set; skipping send");
    return;
  }

  const resend = new Resend(key);
  await resend.emails.send({
    from: data.from?.trim() || defaultFromAddress(),
    to: data.to,
    ...(data.replyTo?.trim() ? { replyTo: data.replyTo.trim() } : {}),
    subject: data.subject,
    html: data.html,
  });
}

export async function sendNewOrderEmail(data: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  await sendEmail({
    to: data.to,
    subject: data.subject,
    html: data.html,
  });
}
