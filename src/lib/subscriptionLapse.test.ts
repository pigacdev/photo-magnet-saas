import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFreePlanRevertPayload,
  isPaidOrganizationPlan,
} from "./clerkBillingSync";
import { buildSubscriptionLapseHtml } from "../../server/src/lib/email";

describe("buildFreePlanRevertPayload", () => {
  it("resets usage counters and clears early-access flags", () => {
    const notifiedAt = new Date("2026-07-15T12:00:00Z");
    const payload = buildFreePlanRevertPayload(notifiedAt);

    assert.equal(payload.plan, "FREE");
    assert.equal(payload.orderLimit, 10);
    assert.equal(payload.eventLimit, 1);
    assert.equal(payload.clerkPlanSlug, "free_user");
    assert.equal(payload.clerkSubscriptionId, null);
    assert.equal(payload.stripeSubscriptionId, null);
    assert.equal(payload.subscriptionPeriodStart, null);
    assert.equal(payload.subscriptionPeriodEnd, null);
    assert.equal(payload.ordersThisMonth, 0);
    assert.equal(payload.eventsCreatedThisMonth, 0);
    assert.equal(payload.isEarlyAccess, false);
    assert.equal(payload.earlyAccessExpiresAt, null);
    assert.equal(payload.subscriptionLapseNotifiedAt, notifiedAt);
  });
});

describe("isPaidOrganizationPlan", () => {
  it("treats HOBBY and PRO as paid", () => {
    assert.equal(isPaidOrganizationPlan("HOBBY"), true);
    assert.equal(isPaidOrganizationPlan("PRO"), true);
    assert.equal(isPaidOrganizationPlan("FREE"), false);
  });
});

describe("buildSubscriptionLapseHtml", () => {
  it("includes post-lapse access and Free plan limits", () => {
    const html = buildSubscriptionLapseHtml({
      sellerName: "Laura",
      previousPlanLabel: "Hobby",
      billingUrl: "https://app.example.com/dashboard/billing",
    });

    assert.match(html, /Your Magnetoo subscription has ended/);
    assert.match(html, /Hi Laura/);
    assert.match(html, /Hobby/);
    assert.match(html, /view all existing orders/i);
    assert.match(html, /print-ready PDFs/i);
    assert.match(html, /event media ZIP/i);
    assert.match(html, /10 new buyer orders per month/);
    assert.match(html, /1 new event per month/);
    assert.match(html, /CSV export/);
    assert.match(html, /https:\/\/app\.example\.com\/dashboard\/billing/);
  });
});
