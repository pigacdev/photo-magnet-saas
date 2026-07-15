import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Safety-net guard: generatePrintSheet must refuse shapes that are not
 * production-validated, before touching the filesystem or DB. Uses a dynamic
 * import so a dummy DATABASE_URL is in place for the prisma module in the
 * generatePrintSheet import chain.
 */
describe("generatePrintSheet production-validation guard", () => {
  it("rejects a non-validated shape", async () => {
    process.env.DATABASE_URL ||=
      "postgresql://user:pass@localhost:5432/db";
    const { generatePrintSheet } = await import(
      "../../server/src/lib/generatePrintSheet"
    );

    await assert.rejects(
      generatePrintSheet("order-test", [], "shape-test", {
        shapeType: "CIRCLE",
        widthMm: 57,
        heightMm: 57,
      }),
      /unvalidated shape/i,
    );
  });
});
