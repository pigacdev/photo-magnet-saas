import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as copy from "./earlyAccessCopy";

describe("earlyAccessCopy", () => {
  it("exposes terms-only scope copy and launch pill", () => {
    assert.equal(
      copy.EARLY_ACCESS_OFFER_SCOPE,
      "Offer applies to Hobby and Pro plans only",
    );
    assert.equal(copy.EARLY_ACCESS_LAUNCH_PILL, "Launch offer");
  });

  it("exposes lifetime discount callout copy with 20% on Hobby and Pro", () => {
    assert.equal(
      copy.EARLY_ACCESS_LIFETIME_DISCOUNT_HEADLINE,
      "Lifetime 20% off Hobby & Pro",
    );
    assert.match(copy.EARLY_ACCESS_LIFETIME_DISCOUNT_SUBLINE, /qualify/i);
    assert.equal(
      copy.EARLY_ACCESS_LIFETIME_DISCOUNT_TERMS_LABEL,
      "Early Access Lifetime Discount Terms",
    );
  });

  it("keeps participation terms for the legal page", () => {
    assert.match(copy.EARLY_ACCESS_PARTICIPATION_TERMS, /run real events/i);
    assert.equal(
      copy.EARLY_ACCESS_EXPECTATION,
      copy.EARLY_ACCESS_PARTICIPATION_TERMS,
    );
  });

  it("does not export removed plan-banner subtext", () => {
    assert.equal("EARLY_ACCESS_PLAN_BANNER_SUBTEXT" in copy, false);
  });
});
