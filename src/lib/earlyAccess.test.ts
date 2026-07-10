import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EARLY_ACCESS_SEAT_LIMIT,
  addDays,
  earlyAccessExpiresAt,
  formatFreeTrialDaysLabel,
  freeTrialDaysRemaining,
  isEarlyAccessEligiblePlanSlug,
  isEarlyAccessOpen,
  isTrialSubscriptionItem,
  seatsRemaining,
} from "./earlyAccess";
import { resolveEarlyAccessTransitionTarget } from "./clerkBillingAdmin";

describe("earlyAccess", () => {
  it("identifies early-access eligible plan slugs", () => {
    assert.equal(isEarlyAccessEligiblePlanSlug("hobby"), true);
    assert.equal(isEarlyAccessEligiblePlanSlug("pro"), true);
    assert.equal(isEarlyAccessEligiblePlanSlug("early_hobby"), false);
    assert.equal(isEarlyAccessEligiblePlanSlug(null), false);
  });

  it("detects trial subscription items", () => {
    assert.equal(isTrialSubscriptionItem({ is_free_trial: true }), true);
    assert.equal(isTrialSubscriptionItem({ status: "free_trial" }), true);
    assert.equal(isTrialSubscriptionItem({ status: "trialing" }), true);
    assert.equal(isTrialSubscriptionItem({ status: "active" }), false);
    assert.equal(isTrialSubscriptionItem(undefined), false);
  });

  it("computes seats remaining", () => {
    assert.equal(seatsRemaining(0), 20);
    assert.equal(seatsRemaining(19), 1);
    assert.equal(seatsRemaining(20), 0);
    assert.equal(seatsRemaining(25), 0);
  });

  it("determines if early access is open", () => {
    assert.equal(isEarlyAccessOpen(0, null), true);
    assert.equal(isEarlyAccessOpen(19, null), true);
    assert.equal(isEarlyAccessOpen(20, null), false);
    assert.equal(isEarlyAccessOpen(5, new Date()), false);
  });

  it("adds 60 days for expiry", () => {
    const start = new Date("2026-01-01T12:00:00Z");
    const expires = earlyAccessExpiresAt(start);
    assert.equal(expires.getTime(), addDays(start, 60).getTime());
  });

  it("seat limit constant is 20", () => {
    assert.equal(EARLY_ACCESS_SEAT_LIMIT, 20);
  });

  it("computes free trial days remaining", () => {
    const now = new Date("2026-07-10T12:00:00Z");
    const inThreeDays = new Date("2026-07-13T06:00:00Z");
    assert.equal(freeTrialDaysRemaining(inThreeDays, now), 3);
    assert.equal(freeTrialDaysRemaining(now, now), 0);
    assert.equal(formatFreeTrialDaysLabel(5), "5 days left on trial");
    assert.equal(formatFreeTrialDaysLabel(1), "1 day left on trial");
    assert.equal(formatFreeTrialDaysLabel(0), "Trial ends today");
  });
});

describe("resolveEarlyAccessTransitionTarget", () => {
  it("resolves loyalty hobby target when discount enabled", () => {
    process.env.CLERK_PRICE_HOBBY_LOYALTY = "cprice_loyalty_hobby";
    const target = resolveEarlyAccessTransitionTarget({
      plan: "HOBBY",
      grantLifetimeDiscount: true,
      currentClerkPlanSlug: "hobby",
    });
    assert.equal(target?.planSlug, "hobby_loyalty");
    assert.equal(target?.priceId, "cprice_loyalty_hobby");
    delete process.env.CLERK_PRICE_HOBBY_LOYALTY;
  });

  it("resolves regular pro when no discount", () => {
    process.env.CLERK_PRICE_PRO = "cprice_pro";
    const target = resolveEarlyAccessTransitionTarget({
      plan: "PRO",
      grantLifetimeDiscount: false,
      currentClerkPlanSlug: "pro",
    });
    assert.equal(target?.planSlug, "pro");
    assert.equal(target?.priceId, "cprice_pro");
    delete process.env.CLERK_PRICE_PRO;
  });
});
