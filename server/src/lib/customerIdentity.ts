/** Normalize email for customer matching (case-insensitive). */
export function normalizeCustomerEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

/** Normalize phone for customer matching (digits and leading + only). */
export function normalizeCustomerPhone(phone: string | null | undefined): string | null {
  const trimmed = phone?.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^\d+]/g, "");
  return digits.length > 0 ? digits : null;
}

export type CustomerContactFields = {
  name: string;
  email: string | null;
  phone: string | null;
};

/**
 * Identity key for deduplication within an org: email first, then phone.
 * Returns null when neither email nor phone is present.
 */
export function customerIdentityKey(
  contact: CustomerContactFields,
): string | null {
  const email = normalizeCustomerEmail(contact.email);
  if (email) return `email:${email}`;
  const phone = normalizeCustomerPhone(contact.phone);
  if (phone) return `phone:${phone}`;
  return null;
}
