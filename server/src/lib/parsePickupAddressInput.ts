import {
  buildStructuredShippingAddress,
  isStructuredShippingAddressComplete,
  parseShippingAddressFromJson,
  type StructuredShippingAddress,
} from "../../../src/lib/shippingAddress";

const PARTIAL_ERROR =
  "Pickup address must include street, house number, city, post code, and country, or be left empty";

export type ParsePickupAddressResult =
  | { kind: "omit" }
  | { kind: "ok"; value: StructuredShippingAddress | null }
  | { kind: "error"; error: string };

function hasAnyField(addr: StructuredShippingAddress): boolean {
  return (
    addr.street.length > 0 ||
    addr.houseNumber.length > 0 ||
    addr.city.length > 0 ||
    addr.postCode.length > 0 ||
    addr.country.length > 0
  );
}

export function parsePickupAddressInput(raw: unknown): ParsePickupAddressResult {
  if (raw === undefined) {
    return { kind: "omit" };
  }
  if (raw === null) {
    return { kind: "ok", value: null };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { kind: "error", error: PARTIAL_ERROR };
  }

  const o = raw as Record<string, unknown>;
  const structured = buildStructuredShippingAddress({
    street: typeof o.street === "string" ? o.street : "",
    houseNumber: typeof o.houseNumber === "string" ? o.houseNumber : "",
    city: typeof o.city === "string" ? o.city : "",
    postCode: typeof o.postCode === "string" ? o.postCode : "",
    country: typeof o.country === "string" ? o.country : "",
  });

  if (!hasAnyField(structured)) {
    return { kind: "ok", value: null };
  }
  if (!isStructuredShippingAddressComplete(structured)) {
    return { kind: "error", error: PARTIAL_ERROR };
  }
  return { kind: "ok", value: structured };
}

/** Reads a stored JSON pickup address from the database. */
export function storedPickupAddressFromJson(
  raw: unknown,
): StructuredShippingAddress | null {
  const parsed = parseShippingAddressFromJson(raw);
  return parsed.kind === "structured" ? parsed.structured : null;
}
