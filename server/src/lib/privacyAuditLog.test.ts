import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatAuditLogLine } from "./privacyAuditLog";

describe("formatAuditLogLine", () => {
  it("formats a complete audit line", () => {
    const line = formatAuditLogLine({
      action: "event_deleted",
      actorEmail: "seller@example.com",
      organizationId: "org-1",
      targetType: "event",
      targetId: "evt-1",
      metadata: { name: "Wedding", orderCount: 3 },
    });
    assert.match(line, /^\[audit\] action=event_deleted/);
    assert.match(line, /actor=seller@example.com/);
    assert.match(line, /org=org-1/);
    assert.match(line, /target=event:evt-1/);
    assert.match(line, /metadata=\{"name":"Wedding","orderCount":3\}/);
  });

  it("omits empty optional fields", () => {
    const line = formatAuditLogLine({
      action: "pii_retention_run",
      metadata: { ordersAnonymized: 5 },
    });
    assert.doesNotMatch(line, /actor=/);
    assert.doesNotMatch(line, /org=/);
    assert.doesNotMatch(line, /target=/);
  });
});
