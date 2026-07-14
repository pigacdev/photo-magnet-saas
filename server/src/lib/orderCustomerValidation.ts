import type { ContextType } from "../../../src/generated/prisma/client";
import { CURRENT_POLICY_VERSION } from "./legalConstants";
import {
  isStructuredShippingAddressComplete,
  parseShippingAddressFromJson,
  type StructuredShippingAddress,
} from "../../../src/lib/shippingAddress";
import {
  STOREFRONT_SHIPPING_TYPES,
  type StorefrontShippingType,
} from "../../../src/lib/shippingTypes";
import { parseValidCustomerEmail } from "./parseOrderNotificationSettings";

export type ValidatedCustomerPayload = {
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  shippingType: string | null;
  shippingAddress:
    | StructuredShippingAddress
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

function parseCustomerEmailField(
  body: Record<string, unknown>,
): { error: string } | { email: string } {
  const parsed = parseValidCustomerEmail(body.customerEmail);
  if (parsed.kind === "error") {
    return { error: parsed.error };
  }
  return { email: parsed.value };
}

function parseCustomerPhoneField(b: Record<string, unknown>): string {
  if (typeof b.customerPhone === "string") return b.customerPhone.trim();
  if (typeof b.phone === "string") return b.phone.trim();
  return "";
}

function parseStructuredAddressFromBody(
  addr: unknown,
): { error: string } | { data: StructuredShippingAddress | { fullAddress: string; notes: string } } {
  if (!addr || typeof addr !== "object" || Array.isArray(addr)) {
    return { error: "Address is required for shipping" };
  }
  const o = addr as Record<string, unknown>;
  const structured: StructuredShippingAddress = {
    street:
      typeof o.street === "string" ? o.street.trim() : "",
    houseNumber:
      typeof o.houseNumber === "string" ? o.houseNumber.trim() : "",
    city: typeof o.city === "string" ? o.city.trim() : "",
    postCode:
      typeof o.postCode === "string" ? o.postCode.trim() : "",
    country: typeof o.country === "string" ? o.country.trim() : "",
  };
  if (isStructuredShippingAddressComplete(structured)) {
    return { data: structured };
  }
  const full =
    typeof o.fullAddress === "string" ? o.fullAddress.trim() : "";
  if (full) {
    const notesRaw = o.notes;
    const notes =
      notesRaw === undefined || notesRaw === null
        ? ""
        : typeof notesRaw === "string"
          ? notesRaw.trim()
          : "";
    return { data: { fullAddress: full, notes } };
  }
  return { error: "Complete shipping address is required" };
}

function isDeliveryAddressComplete(raw: unknown): boolean {
  const parsed = parseShippingAddressFromJson(raw);
  if (parsed.kind === "structured") return true;
  if (parsed.kind === "legacy_full") return parsed.legacyFullAddress.length > 0;
  return false;
}

/**
 * Validates body for PATCH /api/orders/:id/customer by storefront vs event rules.
 */
/** Storefront online payment requires full shipping snapshot (method-specific). */
export function isStorefrontCustomerComplete(order: {
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingType: string | null;
  shippingAddress: unknown | null;
}): boolean {
  if (!order.customerName?.trim()) return false;
  if (!order.customerEmail?.trim()) return false;
  if (!order.customerPhone?.trim()) return false;
  if (!order.shippingType?.trim()) return false;

  const type = parseStorefrontShippingType(order.shippingType);
  if (!type) return false;

  if (type === "pickup") {
    return true;
  }
  if (type === "delivery") {
    return isDeliveryAddressComplete(order.shippingAddress);
  }
  if (type === "boxnow") {
    const parsed = parseShippingAddressFromJson(order.shippingAddress);
    return parsed.kind === "locker" && parsed.lockerId.length > 0;
  }
  return false;
}

/** Buyer must explicitly accept Terms/Privacy before order finalize. */
export function validateCheckoutConsent(body: unknown): { error: string } | { ok: true } {
  if (!body || typeof body !== "object") {
    return { error: "Invalid JSON body" };
  }
  const accepted = (body as { consentAccepted?: unknown }).consentAccepted;
  if (accepted !== true) {
    return {
      error: "You must agree to the Privacy Policy and Terms of Service",
    };
  }
  return { ok: true };
}

export function checkoutConsentFields(): {
  consentAcceptedAt: Date;
  consentVersion: string;
} {
  return {
    consentAcceptedAt: new Date(),
    consentVersion: CURRENT_POLICY_VERSION,
  };
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

  const emailParsed = parseCustomerEmailField(b);
  if ("error" in emailParsed) {
    return { error: emailParsed.error };
  }

  if (contextType === "EVENT") {
    const phone = parseCustomerPhoneField(b);
    if (!phone) {
      return { error: "Phone is required" };
    }
    return {
      data: {
        customerName: name,
        customerEmail: emailParsed.email,
        customerPhone: phone,
        shippingType: null,
        shippingAddress: null,
      },
    };
  }

  const phone = parseCustomerPhoneField(b);
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
        customerEmail: emailParsed.email,
        customerPhone: phone,
        shippingType: "pickup",
        shippingAddress: null,
      },
    };
  }

  const addr = b.shippingAddress;
  if (shippingType === "delivery") {
    const parsedAddr = parseStructuredAddressFromBody(addr);
    if ("error" in parsedAddr) {
      return parsedAddr;
    }
    return {
      data: {
        customerName: name,
        customerEmail: emailParsed.email,
        customerPhone: phone,
        shippingType: "delivery",
        shippingAddress: parsedAddr.data,
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
      customerEmail: emailParsed.email,
      customerPhone: phone,
      shippingType: "boxnow",
      shippingAddress: { lockerId },
    },
  };
}
