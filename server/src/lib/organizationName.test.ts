import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeOrganizationName,
  ORGANIZATION_NAME_MAX_LEN,
} from "./organizationName";

describe("normalizeOrganizationName", () => {
  it("accepts trimmed non-empty names", () => {
    const result = normalizeOrganizationName("  Laura Prints  ");
    assert.equal(result.kind, "ok");
    if (result.kind === "ok") {
      assert.equal(result.value, "Laura Prints");
    }
  });

  it("rejects empty names", () => {
    const result = normalizeOrganizationName("   ");
    assert.equal(result.kind, "error");
  });

  it("rejects names over max length", () => {
    const result = normalizeOrganizationName("x".repeat(ORGANIZATION_NAME_MAX_LEN + 1));
    assert.equal(result.kind, "error");
  });
});
