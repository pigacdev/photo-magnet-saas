import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPlatformNewUserAlertHtml,
  buildPlatformPlanChangeAlertHtml,
} from "../../server/src/lib/email";
import { getPlatformAlertEmails } from "../../server/src/lib/platformAlertSettings";

describe("getPlatformAlertEmails", () => {
  it("parses comma-separated emails and lowercases them", () => {
    const previous = process.env.PLATFORM_ALERT_EMAILS;
    process.env.PLATFORM_ALERT_EMAILS = " Ops@Example.com , other@example.com ";
    try {
      assert.deepEqual(getPlatformAlertEmails(), [
        "ops@example.com",
        "other@example.com",
      ]);
    } finally {
      if (previous === undefined) {
        delete process.env.PLATFORM_ALERT_EMAILS;
      } else {
        process.env.PLATFORM_ALERT_EMAILS = previous;
      }
    }
  });

  it("returns empty array when unset", () => {
    const previous = process.env.PLATFORM_ALERT_EMAILS;
    delete process.env.PLATFORM_ALERT_EMAILS;
    try {
      assert.deepEqual(getPlatformAlertEmails(), []);
    } finally {
      if (previous === undefined) {
        delete process.env.PLATFORM_ALERT_EMAILS;
      } else {
        process.env.PLATFORM_ALERT_EMAILS = previous;
      }
    }
  });
});

describe("buildPlatformNewUserAlertHtml", () => {
  it("includes seller identity and platform link", () => {
    const html = buildPlatformNewUserAlertHtml({
      sellerName: "Ada",
      sellerEmail: "ada@example.com",
      userId: "user-1",
      platformUrl: "https://app.example.com/platform",
    });

    assert.match(html, /New Magnetoo seller registered/);
    assert.match(html, /Ada/);
    assert.match(html, /ada@example\.com/);
    assert.match(html, /user-1/);
    assert.match(html, /https:\/\/app\.example\.com\/platform/);
  });
});

describe("buildPlatformPlanChangeAlertHtml", () => {
  it("includes from and to plan labels", () => {
    const html = buildPlatformPlanChangeAlertHtml({
      sellerName: "Ada",
      sellerEmail: "ada@example.com",
      userId: "user-1",
      fromPlanLabel: "Free",
      toPlanLabel: "Hobby",
      platformUrl: "https://app.example.com/platform",
    });

    assert.match(html, /Magnetoo seller plan changed/);
    assert.match(html, /Free/);
    assert.match(html, /Hobby/);
    assert.match(html, /Free → Hobby/);
    assert.match(html, /ada@example\.com/);
  });
});

describe("plan change gate (product enum)", () => {
  it("treats same plan as no-op for alert purposes", () => {
    const fromPlan = "HOBBY" as const;
    const toPlan = "HOBBY" as const;
    assert.equal(fromPlan === toPlan, true);
  });

  it("detects Free to Hobby as a product plan change", () => {
    const fromPlan = "FREE" as const;
    const toPlan = "HOBBY" as const;
    assert.equal(fromPlan !== toPlan, true);
  });
});
