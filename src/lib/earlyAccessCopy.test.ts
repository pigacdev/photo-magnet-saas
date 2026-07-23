import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as copy from "./earlyAccessCopy";

describe("earlyAccessCopy", () => {
  it("exposes Hobby/Pro-only offer scope and launch pill", () => {
    assert.equal(
      copy.EARLY_ACCESS_OFFER_SCOPE,
      "Offer applies to Hobby and Pro plans only",
    );
    assert.equal(copy.EARLY_ACCESS_LAUNCH_PILL, "Launch offer");
  });

  it("does not export removed plan-banner subtext", () => {
    assert.equal(
      "EARLY_ACCESS_PLAN_BANNER_SUBTEXT" in copy,
      false,
    );
  });
});
