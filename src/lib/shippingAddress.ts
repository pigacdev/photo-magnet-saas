/** Structured shipping address stored in `Order.shippingAddress` for delivery orders. */
export type StructuredShippingAddress = {
  street: string;
  houseNumber: string;
  city: string;
  postCode: string;
  country: string;
};

export type ShippingAddressFormFields = StructuredShippingAddress;

export type ParsedShippingAddress = {
  kind: "structured" | "legacy_full" | "locker" | "empty";
  structured: StructuredShippingAddress;
  legacyFullAddress: string;
  legacyNotes: string;
  lockerId: string;
};

const EMPTY_STRUCTURED: StructuredShippingAddress = {
  street: "",
  houseNumber: "",
  city: "",
  postCode: "",
  country: "",
};

function trimStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function splitCustomerName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const space = trimmed.indexOf(" ");
  if (space <= 0) return { firstName: trimmed, lastName: "" };
  return {
    firstName: trimmed.slice(0, space),
    lastName: trimmed.slice(space + 1).trim(),
  };
}

export function joinCustomerName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

export function buildStructuredShippingAddress(
  fields: ShippingAddressFormFields,
): StructuredShippingAddress {
  return {
    street: fields.street.trim(),
    houseNumber: fields.houseNumber.trim(),
    city: fields.city.trim(),
    postCode: fields.postCode.trim(),
    country: fields.country.trim(),
  };
}

export function isStructuredShippingAddressComplete(
  addr: StructuredShippingAddress,
): boolean {
  return (
    addr.street.length > 0 &&
    addr.houseNumber.length > 0 &&
    addr.city.length > 0 &&
    addr.postCode.length > 0 &&
    addr.country.length > 0
  );
}

export function parseShippingAddressFromJson(
  raw: unknown,
): ParsedShippingAddress {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      kind: "empty",
      structured: { ...EMPTY_STRUCTURED },
      legacyFullAddress: "",
      legacyNotes: "",
      lockerId: "",
    };
  }

  const o = raw as Record<string, unknown>;
  const lockerId = trimStr(o.lockerId);
  if (lockerId) {
    return {
      kind: "locker",
      structured: { ...EMPTY_STRUCTURED },
      legacyFullAddress: "",
      legacyNotes: "",
      lockerId,
    };
  }

  const structured: StructuredShippingAddress = {
    street: trimStr(o.street),
    houseNumber: trimStr(o.houseNumber),
    city: trimStr(o.city),
    postCode: trimStr(o.postCode),
    country: trimStr(o.country),
  };

  if (isStructuredShippingAddressComplete(structured)) {
    return {
      kind: "structured",
      structured,
      legacyFullAddress: "",
      legacyNotes: "",
      lockerId: "",
    };
  }

  const legacyFullAddress = trimStr(o.fullAddress);
  const legacyNotes = trimStr(o.notes);
  if (legacyFullAddress) {
    return {
      kind: "legacy_full",
      structured: { ...EMPTY_STRUCTURED },
      legacyFullAddress,
      legacyNotes,
      lockerId: "",
    };
  }

  return {
    kind: "empty",
    structured,
    legacyFullAddress: "",
    legacyNotes: "",
    lockerId: "",
  };
}

/** Human-readable lines for dashboard display. */
export function formatShippingAddressLines(raw: unknown): string[] {
  const parsed = parseShippingAddressFromJson(raw);
  if (parsed.kind === "locker") {
    return [`BoxNow locker: ${parsed.lockerId}`];
  }
  if (parsed.kind === "legacy_full") {
    const lines = [parsed.legacyFullAddress];
    if (parsed.legacyNotes) lines.push(parsed.legacyNotes);
    return lines;
  }
  if (parsed.kind === "structured") {
    const { street, houseNumber, city, postCode, country } = parsed.structured;
    const line1 = [street, houseNumber].filter(Boolean).join(" ");
    const line2 = [postCode, city].filter(Boolean).join(" ");
    return [line1, line2, country].filter(Boolean);
  }
  return [];
}
