import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  advanceBillingPeriodToContain,
  defaultBillingPeriodEnd,
  isCorruptedUsagePeriod,
  resolveUsagePeriodWindow,
} from "./billingPeriod";

describe("billingPeriod", () => {
  it("detects annual Clerk period stored in usage fields as corrupted", () => {
    const start = new Date("2026-06-03T13:17:17.054Z");
    const end = new Date("2027-06-03T13:17:17.054Z");
    assert.equal(isCorruptedUsagePeriod(start, end), true);
  });

  it("treats a normal monthly window as valid", () => {
    const start = new Date("2026-06-03T13:17:17.054Z");
    const end = defaultBillingPeriodEnd(start);
    assert.equal(isCorruptedUsagePeriod(start, end), false);
  });

  it("normalizes yearly period to current monthly window on subscription anniversary", () => {
    const anchor = new Date("2026-06-03T13:17:17.054Z");
    const annualEnd = new Date("2027-06-03T13:17:17.054Z");
    const now = new Date("2026-07-01T12:00:00.000Z");

    const window = resolveUsagePeriodWindow(anchor, annualEnd, now);

    assert.equal(window.currentPeriodStart.toISOString(), anchor.toISOString());
    assert.equal(
      window.currentPeriodEnd.toISOString(),
      defaultBillingPeriodEnd(anchor).toISOString(),
    );
  });

  it("advances monthly windows when now is past period end", () => {
    const start = new Date("2026-06-03T00:00:00.000Z");
    const end = new Date("2026-07-03T00:00:00.000Z");
    const now = new Date("2026-08-05T00:00:00.000Z");

    const window = advanceBillingPeriodToContain(start, end, now);

    assert.equal(
      window.currentPeriodStart.toISOString(),
      new Date("2026-08-03T00:00:00.000Z").toISOString(),
    );
    assert.equal(
      window.currentPeriodEnd.toISOString(),
      new Date("2026-09-03T00:00:00.000Z").toISOString(),
    );
  });

  it("steps through multiple expired months from a corrupted annual period", () => {
    const anchor = new Date("2026-06-03T00:00:00.000Z");
    const annualEnd = new Date("2027-06-03T00:00:00.000Z");
    const now = new Date("2026-09-10T00:00:00.000Z");

    const window = resolveUsagePeriodWindow(anchor, annualEnd, now);
    const expectedStart = new Date("2026-09-03T00:00:00.000Z");

    assert.equal(
      window.currentPeriodStart.toISOString(),
      expectedStart.toISOString(),
    );
    assert.equal(
      window.currentPeriodEnd.toISOString(),
      defaultBillingPeriodEnd(expectedStart).toISOString(),
    );
  });
});
