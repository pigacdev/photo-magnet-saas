import type { Prisma } from "../generated/prisma/client";

export type SellerUserAccessFields = {
  deletedAt: Date | null;
  erasureScheduledAt: Date | null;
};

/** Active seller or still within account-erasure grace period. */
export function sellerUserIsAccessible(user: SellerUserAccessFields): boolean {
  if (user.deletedAt == null) return true;
  return (
    user.erasureScheduledAt != null &&
    user.erasureScheduledAt.getTime() > Date.now()
  );
}

/** Prisma where fragment: active OR pending erasure before hard purge. */
export function sellerUserAccessibleWhere(): Prisma.UserWhereInput {
  return {
    OR: [{ deletedAt: null }, { erasureScheduledAt: { gt: new Date() } }],
  };
}

export class SellerAccountUnavailableError extends Error {
  constructor(message = "Account is pending permanent deletion") {
    super(message);
    this.name = "SellerAccountUnavailableError";
  }
}
