import type { Prisma } from "../../../src/generated/prisma/client";
import {
  normalizeCustomerEmail,
  normalizeCustomerPhone,
} from "./customerIdentity";

export type CustomerUpsertInput = {
  name: string;
  email: string | null;
  phone: string | null;
};

type TransactionClient = Prisma.TransactionClient;

/**
 * Find or create an active Customer for the org (match email, then phone).
 * Updates name/email/phone to latest checkout values when matched.
 */
export async function upsertCustomerForOrder(
  tx: TransactionClient,
  organizationId: string,
  input: CustomerUpsertInput,
): Promise<string | null> {
  const name = input.name.trim();
  if (!name) return null;

  const emailNorm = normalizeCustomerEmail(input.email);
  const phoneNorm = normalizeCustomerPhone(input.phone);
  if (!emailNorm && !phoneNorm) return null;

  let existing = null;

  if (emailNorm) {
    existing = await tx.customer.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        email: { equals: input.email?.trim() ?? "", mode: "insensitive" },
      },
      select: { id: true },
    });
  }

  if (!existing && phoneNorm) {
    const candidates = await tx.customer.findMany({
      where: {
        organizationId,
        deletedAt: null,
        phone: { not: null },
      },
      select: { id: true, phone: true },
    });
    existing =
      candidates.find(
        (c) => normalizeCustomerPhone(c.phone) === phoneNorm,
      ) ?? null;
  }

  const data = {
    name,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
  };

  if (existing) {
    await tx.customer.update({
      where: { id: existing.id },
      data,
    });
    return existing.id;
  }

  const created = await tx.customer.create({
    data: {
      organizationId,
      ...data,
    },
    select: { id: true },
  });
  return created.id;
}
