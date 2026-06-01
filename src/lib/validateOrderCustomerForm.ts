import {
  normalizeLegacyShippingType,
  type StorefrontShippingType,
} from "@/lib/shippingTypes";
import {
  buildStructuredShippingAddress,
  isStructuredShippingAddressComplete,
  joinCustomerName,
  splitCustomerName,
  type StructuredShippingAddress,
} from "@/lib/shippingAddress";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CustomerFormValues = {
  firstName: string;
  lastName: string;
  customerEmail: string;
  customerPhone: string;
  shippingType: StorefrontShippingType;
  street: string;
  houseNumber: string;
  city: string;
  postCode: string;
  country: string;
  lockerId: string;
};

export type CustomerFieldKey =
  | "firstName"
  | "lastName"
  | "customerEmail"
  | "customerPhone"
  | "street"
  | "houseNumber"
  | "city"
  | "postCode"
  | "country"
  | "lockerId";

export type CustomerFieldErrors = Partial<Record<CustomerFieldKey, string>>;

export function valuesFromCustomerOrder(order: {
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingType: string | null;
  shippingAddress: unknown | null;
}): CustomerFormValues {
  const { firstName, lastName } = splitCustomerName(order.customerName ?? "");
  const base: CustomerFormValues = {
    firstName,
    lastName,
    customerEmail: order.customerEmail ?? "",
    customerPhone: order.customerPhone ?? "",
    shippingType: normalizeLegacyShippingType(order.shippingType),
    street: "",
    houseNumber: "",
    city: "",
    postCode: "",
    country: "",
    lockerId: "",
  };

  const addr = order.shippingAddress;
  if (addr && typeof addr === "object" && !Array.isArray(addr)) {
    const o = addr as Record<string, unknown>;
    if (typeof o.lockerId === "string") {
      base.lockerId = o.lockerId;
    }
    if (typeof o.street === "string") base.street = o.street;
    if (typeof o.houseNumber === "string") base.houseNumber = o.houseNumber;
    if (typeof o.city === "string") base.city = o.city;
    if (typeof o.postCode === "string") base.postCode = o.postCode;
    if (typeof o.country === "string") base.country = o.country;
    if (
      typeof o.fullAddress === "string" &&
      o.fullAddress &&
      !base.street
    ) {
      base.street = o.fullAddress;
    }
  }
  return base;
}

export function validateCustomerEditForm(
  contextType: "EVENT" | "STOREFRONT",
  values: CustomerFormValues,
): CustomerFieldErrors {
  const errors: CustomerFieldErrors = {};

  if (!values.firstName.trim()) {
    errors.firstName = "First name is required";
  }
  if (!values.lastName.trim()) {
    errors.lastName = "Last name is required";
  }

  const email = values.customerEmail.trim();
  if (!email) {
    errors.customerEmail = "Email is required";
  } else if (!EMAIL_RE.test(email)) {
    errors.customerEmail = "Invalid email address";
  }

  if (contextType === "EVENT") {
    if (!values.customerPhone.trim()) {
      errors.customerPhone = "Phone is required";
    }
    return errors;
  }

  if (contextType === "STOREFRONT") {
    if (!values.customerPhone.trim()) {
      errors.customerPhone = "Phone is required for delivery orders";
    }
    if (values.shippingType === "delivery") {
      const structured = buildStructuredShippingAddress(values);
      if (!isStructuredShippingAddressComplete(structured)) {
        if (!structured.street) errors.street = "Street is required";
        if (!structured.houseNumber) {
          errors.houseNumber = "House number is required";
        }
        if (!structured.city) errors.city = "City is required";
        if (!structured.postCode) errors.postCode = "Post code is required";
        if (!structured.country) errors.country = "Country is required";
      }
    }
    if (values.shippingType === "boxnow" && !values.lockerId.trim()) {
      errors.lockerId = "Locker id is required for BoxNow";
    }
  }

  return errors;
}

function buildShippingAddressPayload(
  shippingType: StorefrontShippingType,
  values: CustomerFormValues,
): StructuredShippingAddress | { lockerId: string } | null {
  if (shippingType === "pickup") return null;
  if (shippingType === "boxnow") {
    return { lockerId: values.lockerId.trim() };
  }
  return buildStructuredShippingAddress(values);
}

export function buildCustomerPatchBody(
  contextType: "EVENT" | "STOREFRONT",
  values: CustomerFormValues,
): Record<string, unknown> {
  const customerName = joinCustomerName(values.firstName, values.lastName);
  const email = values.customerEmail.trim();
  const phone = values.customerPhone.trim();

  if (contextType === "EVENT") {
    return {
      customerName,
      customerEmail: email,
      customerPhone: phone,
    };
  }

  return {
    customerName,
    customerEmail: email,
    customerPhone: phone,
    shippingType: values.shippingType,
    shippingAddress: buildShippingAddressPayload(values.shippingType, values),
  };
}

export function mapApiCustomerErrorToFields(
  message: string,
): CustomerFieldErrors {
  const m = message.toLowerCase();
  if (m.includes("email")) return { customerEmail: message };
  if (m.includes("first name") || m.includes("name")) {
    return m.includes("last") ? { lastName: message } : { firstName: message };
  }
  if (m.includes("phone")) return { customerPhone: message };
  if (m.includes("locker")) return { lockerId: message };
  if (m.includes("street")) return { street: message };
  if (m.includes("house")) return { houseNumber: message };
  if (m.includes("city")) return { city: message };
  if (m.includes("post")) return { postCode: message };
  if (m.includes("country")) return { country: message };
  if (m.includes("address")) return { street: message };
  return {};
}
