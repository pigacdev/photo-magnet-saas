import type { ContextType } from "../../../src/generated/prisma/client";
import {
  STOREFRONT_SHIPPING_TYPES,
  type StorefrontShippingType,
} from "../../../src/lib/shippingTypes";

export type ValidatedCustomerPayload = {
  customerName: string;
  customerPhone: string | null;
  shippingType: string | null;
  shippingAddress:
    | { fullAddress: string; notes: string }
    | { lockerId: string }
    | null;
};

function parseStorefrontShippingType(
  raw: unknown,
): StorefrontShippingType | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase();
  if (t === "standard" || t === "express") return "delivery";
  if (STOREFRONT_SHIPPING_TYPES.includes(t as StorefrontShippingType)) {
    return t as StorefrontShippingType;
  }
  return null;
}

/**
 * Validates body for PATCH /api/orders/:id/customer by storefront vs event rules.
 */
/** Storefront online payment requires full shipping snapshot (method-specific). */
export function isStorefrontCustomerComplete(order: {
  customerName: string | null;
  customerPhone: string | null;
  shippingType: string | null;
  shippingAddress: unknown | null;
}): boolean {
  if (!order.customerName?.trim()) return false;
  if (!order.customerPhone?.trim()) return false;
  if (!order.shippingType?.trim()) return false;

  const type = parseStorefrontShippingType(order.shippingType);
  if (!type) return false;

  const a = order.shippingAddress;
  if (type === "pickup") {
    return true;
  }
  if (type === "delivery") {
    if (!a || typeof a !== "object" || Array.isArray(a)) return false;
    const full = (a as { fullAddress?: unknown }).fullAddress;
    return typeof full === "string" && full.trim().length > 0;
  }
  if (type === "boxnow") {
    if (!a || typeof a !== "object" || Array.isArray(a)) return false;
    const lid = (a as { lockerId?: unknown }).lockerId;
    return typeof lid === "string" && lid.trim().length > 0;
  }
  return false;
}

export function validateOrderCustomerBody(
  contextType: ContextType,
  body: unknown,
): { error: string } | { data: ValidatedCustomerPayload } {
  if (!body || typeof body !== "object") {
    return { error: "Invalid JSON body" };
  }
  const b = body as Record<string, unknown>;
  const nameRaw = b.customerName;
  const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
  if (!name) {
    return { error: "Name is required" };
  }

  if (contextType === "EVENT") {
    const phone =
      typeof b.customerPhone === "string" ? b.customerPhone.trim() : "";
    return {
      data: {
        customerName: name,
        customerPhone: phone.length > 0 ? phone : null,
        shippingType: null,
        shippingAddress: null,
      },
    };
  }

  const phone =
    typeof b.customerPhone === "string" ? b.customerPhone.trim() : "";
  if (!phone) {
    return { error: "Phone is required for delivery orders" };
  }

  const shippingType = parseStorefrontShippingType(b.shippingType);
  if (!shippingType) {
    return {
      error: "Shipping type must be pickup, delivery, or boxnow",
    };
  }

  if (shippingType === "pickup") {
    return {
      data: {
        customerName: name,
        customerPhone: phone,
        shippingType: "pickup",
        shippingAddress: null,
      },
    };
  }

  const addr = b.shippingAddress;
  if (shippingType === "delivery") {
    if (!addr || typeof addr !== "object" || Array.isArray(addr)) {
      return { error: "Address is required for delivery" };
    }
    const full =
      typeof (addr as { fullAddress?: unknown }).fullAddress === "string"
        ? String((addr as { fullAddress: string }).fullAddress).trim()
        : "";
    if (!full) {
      return { error: "Address is required for delivery" };
    }
    const notesRaw = (addr as { notes?: unknown }).notes;
    const notes =
      notesRaw === undefined || notesRaw === null
        ? ""
        : typeof notesRaw === "string"
          ? notesRaw.trim()
          : "";
    return {
      data: {
        customerName: name,
        customerPhone: phone,
        shippingType: "delivery",
        shippingAddress: { fullAddress: full, notes },
      },
    };
  }

  /* boxnow */
  if (!addr || typeof addr !== "object" || Array.isArray(addr)) {
    return { error: "Locker id is required for BoxNow" };
  }
  const lockerId =
    typeof (addr as { lockerId?: unknown }).lockerId === "string"
      ? String((addr as { lockerId: string }).lockerId).trim()
      : "";
  if (!lockerId) {
    return { error: "Locker id is required for BoxNow" };
  }
  return {
    data: {
      customerName: name,
      customerPhone: phone,
      shippingType: "boxnow",
      shippingAddress: { lockerId },
    },
  };
}
