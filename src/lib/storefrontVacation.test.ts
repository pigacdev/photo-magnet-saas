import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isVacationActive,
  isVacationScheduled,
  parseVacationDateRange,
  parseVacationModeInput,
} from "../../server/src/lib/storefront.ts";

describe("storefront vacation mode", () => {
  it("parses valid date range", () => {
    const r = parseVacationDateRange("2026-07-10", "2026-07-20");
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.from.toISOString(), "2026-07-10T00:00:00.000Z");
      assert.equal(r.to.toISOString(), "2026-07-20T23:59:59.999Z");
    }
  });

  it("rejects end before start", () => {
    const r = parseVacationDateRange("2026-07-20", "2026-07-10");
    assert.equal(r.ok, false);
  });

  it("rejects end date in the past", () => {
    const r = parseVacationDateRange("2020-01-01", "2020-01-02");
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.error, "Vacation end date cannot be in the past");
    }
  });

  it("detects scheduled vacation", () => {
    const sf = {
      vacationFrom: new Date("2026-07-10T00:00:00.000Z"),
      vacationTo: new Date("2026-07-20T23:59:59.999Z"),
    };
    assert.equal(isVacationScheduled(sf), true);
  });

  it("blocks vacation on Free plan even with dates", () => {
    const sf = {
      vacationFrom: new Date("2000-01-01T00:00:00.000Z"),
      vacationTo: new Date("2099-12-31T23:59:59.999Z"),
    };
    assert.equal(isVacationActive(sf, "FREE"), false);
    assert.equal(isVacationActive(sf, "HOBBY"), true);
  });

  it("clears vacation on disable input", () => {
    const r = parseVacationModeInput({
      vacationFrom: null,
      vacationTo: null,
      vacationNote: null,
    });
    assert.deepEqual(r, { ok: true, from: null, to: null, note: null });
  });
});
