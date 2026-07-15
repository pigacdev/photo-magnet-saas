import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SellerAccountUnavailableError,
  sellerUserAccessibleWhere,
  sellerUserIsAccessible,
} from "./sellerUserAccess";

describe("sellerUserIsAccessible", () => {
  it("returns true for active users", () => {
    assert.equal(
      sellerUserIsAccessible({ deletedAt: null, erasureScheduledAt: null }),
      true,
    );
  });

  it("returns true during erasure grace period", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    assert.equal(
      sellerUserIsAccessible({
        deletedAt: new Date(),
        erasureScheduledAt: future,
      }),
      true,
    );
  });

  it("returns false for past-grace tombstones", () => {
    const past = new Date(Date.now() - 60_000);
    assert.equal(
      sellerUserIsAccessible({
        deletedAt: new Date(),
        erasureScheduledAt: past,
      }),
      false,
    );
  });

  it("returns false when soft-deleted without erasureScheduledAt", () => {
    assert.equal(
      sellerUserIsAccessible({
        deletedAt: new Date(),
        erasureScheduledAt: null,
      }),
      false,
    );
  });
});

describe("sellerUserAccessibleWhere", () => {
  it("includes active and grace-period conditions", () => {
    const where = sellerUserAccessibleWhere();
    assert.ok(Array.isArray(where.OR));
    assert.equal(where.OR?.length, 2);
    assert.deepEqual(where.OR?.[0], { deletedAt: null });
    assert.ok(
      where.OR?.[1] &&
        typeof where.OR[1] === "object" &&
        "erasureScheduledAt" in where.OR[1],
    );
  });
});

describe("SellerAccountUnavailableError", () => {
  it("uses a stable error name", () => {
    const err = new SellerAccountUnavailableError();
    assert.equal(err.name, "SellerAccountUnavailableError");
    assert.equal(err.message, "Account is pending permanent deletion");
  });
});
