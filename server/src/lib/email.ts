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

export function buildOrderEmailSubject(
  order: Pick<OrderForEmail, "id">,
  contextName: string,
): string {
  const shortId = order.id.slice(0, 6).toUpperCase();

  return `📦 ${contextName} — New order received (#${shortId})`;
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

export async function sendNewOrderEmail(data: {
  to: string;
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
    from: "Magnetoo <onboarding@resend.dev>", // TODO: change to actual email before production
    to: data.to,
    subject: data.subject,
    html: data.html,
  });
}
