import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clerkBillingPeriodFields,
  extractClerkBillingPeriod,
} from "./clerkBillingPeriod";

const MAY_START = 1_715_692_800; // 2024-05-15T00:00:00.000Z
const JUN_END = 1_718_371_200; // 2024-06-15T00:00:00.000Z

describe("extractClerkBillingPeriod", () => {
  it("reads period_start and period_end from subscription items", () => {
    const period = extractClerkBillingPeriod({
      items: [
        {
          plan: { slug: "pro" },
          status: "active",
          period_start: MAY_START,
          period_end: JUN_END,
        },
      ],
    });

    assert.ok(period);
    assert.equal(period.currentPeriodStart.toISOString(), new Date(MAY_START * 1000).toISOString());
    assert.equal(period.currentPeriodEnd.toISOString(), new Date(JUN_END * 1000).toISOString());
  });

  it("prefers paid item period when free and paid items coexist", () => {
    const freeStart = 1_714_000_000;
    const freeEnd = 1_716_678_400;
    const period = extractClerkBillingPeriod({
      items: [
        {
          plan: { slug: "free_user" },
          status: "active",
          period_start: freeStart,
          period_end: freeEnd,
        },
        {
          plan: { slug: "hobby" },
          status: "active",
          period_start: MAY_START,
          period_end: JUN_END,
        },
      ],
    });

    assert.ok(period);
    assert.equal(period.currentPeriodStart.getTime(), MAY_START * 1000);
    assert.equal(period.currentPeriodEnd.getTime(), JUN_END * 1000);
  });

  it("uses free item period when preferPaidPlan is false", () => {
    const freeStart = 1_714_000_000;
    const freeEnd = 1_716_678_400;
    const period = extractClerkBillingPeriod(
      {
        items: [
          {
            plan: { slug: "free_user" },
            status: "active",
            period_start: freeStart,
            period_end: freeEnd,
          },
          {
            plan: { slug: "hobby" },
            status: "active",
            period_start: MAY_START,
            period_end: JUN_END,
          },
        ],
      },
      { preferPaidPlan: false },
    );

    assert.ok(period);
    assert.equal(period.currentPeriodStart.getTime(), freeStart * 1000);
    assert.equal(period.currentPeriodEnd.getTime(), freeEnd * 1000);
  });

  it("reads period from a subscription item webhook payload", () => {
    const period = extractClerkBillingPeriod({
      plan: { slug: "pro" },
      status: "active",
      period_start: MAY_START,
      period_end: JUN_END,
    });

    assert.ok(period);
    assert.equal(period.currentPeriodEnd.getTime(), JUN_END * 1000);
  });

  it("reads period from a subscription item in items array", () => {
    const period = extractClerkBillingPeriod({
      items: [
        {
          plan: { slug: "pro" },
          status: "active",
          period_start: MAY_START,
          period_end: JUN_END,
        },
      ],
    });

    assert.ok(period);
    assert.equal(period.currentPeriodEnd.getTime(), JUN_END * 1000);
  });

  it("falls back to root current_period_start and current_period_end", () => {
    const period = extractClerkBillingPeriod({
      current_period_start: MAY_START,
      current_period_end: JUN_END,
    });

    assert.ok(period);
    assert.equal(period.currentPeriodEnd.getTime(), JUN_END * 1000);
  });

  it("returns null when period_end is missing or null", () => {
    assert.equal(
      extractClerkBillingPeriod({
        items: [{ plan: { slug: "pro" }, status: "active", period_start: MAY_START }],
      }),
      null,
    );
    assert.equal(
      extractClerkBillingPeriod({
        items: [
          {
            plan: { slug: "pro" },
            status: "active",
            period_start: MAY_START,
            period_end: null,
          },
        ],
      }),
      null,
    );
  });

  it("accepts millisecond timestamps", () => {
    const period = extractClerkBillingPeriod({
      period_start: MAY_START * 1000,
      period_end: JUN_END * 1000,
    });

    assert.ok(period);
    assert.equal(period.currentPeriodStart.getTime(), MAY_START * 1000);
    assert.equal(period.currentPeriodEnd.getTime(), JUN_END * 1000);
  });

  it("rejects inverted periods", () => {
    assert.equal(
      extractClerkBillingPeriod({
        period_start: JUN_END,
        period_end: MAY_START,
      }),
      null,
    );
  });
});

describe("clerkBillingPeriodFields", () => {
  it("returns empty object when Clerk period is unavailable", () => {
    assert.deepEqual(clerkBillingPeriodFields({ items: [] }), {});
    assert.deepEqual(clerkBillingPeriodFields({}), {});
  });

  it("is stable across repeated calls with missing data", () => {
    const payload = { items: [{ plan: { slug: "pro" }, status: "active" }] };
    assert.deepEqual(clerkBillingPeriodFields(payload), {});
    assert.deepEqual(clerkBillingPeriodFields(payload), {});
  });

  it("maps extracted period to org update fields", () => {
    const fields = clerkBillingPeriodFields({
      period_start: MAY_START,
      period_end: JUN_END,
    });

    assert.equal(fields.currentPeriodStart?.getTime(), MAY_START * 1000);
    assert.equal(fields.currentPeriodEnd?.getTime(), JUN_END * 1000);
  });
});
