import type { StorefrontShippingType } from "@/lib/shippingTypes";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CustomerFormValues = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingType: StorefrontShippingType;
  fullAddress: string;
  addressNotes: string;
  lockerId: string;
};

export type CustomerFieldKey =
  | "customerName"
  | "customerEmail"
  | "customerPhone"
  | "fullAddress"
  | "lockerId";

export type CustomerFieldErrors = Partial<Record<CustomerFieldKey, string>>;

export function validateCustomerEditForm(
  contextType: "EVENT" | "STOREFRONT",
  values: CustomerFormValues,
): CustomerFieldErrors {
  const errors: CustomerFieldErrors = {};

  if (!values.customerName.trim()) {
    errors.customerName = "Name is required";
  }

  const email = values.customerEmail.trim();
  if (!email) {
    errors.customerEmail = "Email is required";
  } else if (!EMAIL_RE.test(email)) {
    errors.customerEmail = "Invalid email address";
  }

  if (contextType === "STOREFRONT") {
    if (!values.customerPhone.trim()) {
      errors.customerPhone = "Phone is required for delivery orders";
    }
    if (values.shippingType === "delivery" && !values.fullAddress.trim()) {
      errors.fullAddress = "Address is required for delivery";
    }
    if (values.shippingType === "boxnow" && !values.lockerId.trim()) {
      errors.lockerId = "Locker id is required for BoxNow";
    }
  }

  return errors;
}

export function buildCustomerPatchBody(
  contextType: "EVENT" | "STOREFRONT",
  values: CustomerFormValues,
): Record<string, unknown> {
  const name = values.customerName.trim();
  const email = values.customerEmail.trim();
  const phone = values.customerPhone.trim();

  if (contextType === "EVENT") {
    return {
      customerName: name,
      customerEmail: email,
      ...(phone ? { customerPhone: phone } : {}),
    };
  }

  if (values.shippingType === "pickup") {
    return {
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      shippingType: "pickup",
      shippingAddress: null,
    };
  }

  if (values.shippingType === "delivery") {
    return {
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      shippingType: "delivery",
      shippingAddress: {
        fullAddress: values.fullAddress.trim(),
        notes: values.addressNotes.trim(),
      },
    };
  }

  return {
    customerName: name,
    customerEmail: email,
    customerPhone: phone,
    shippingType: "boxnow",
    shippingAddress: { lockerId: values.lockerId.trim() },
  };
}

export function mapApiCustomerErrorToFields(
  message: string,
): CustomerFieldErrors {
  const m = message.toLowerCase();
  if (m.includes("email")) return { customerEmail: message };
  if (m.includes("name")) return { customerName: message };
  if (m.includes("phone")) return { customerPhone: message };
  if (m.includes("locker")) return { lockerId: message };
  if (m.includes("address")) return { fullAddress: message };
  return {};
}
