import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shapesForSellerCatalog } from "../../server/src/lib/allowedShapeLifecycle";

describe("allowedShapeLifecycle", () => {
  it("shapesForSellerCatalog returns only production-validated shapes", () => {
    const rows = shapesForSellerCatalog([
      { shapeType: "SQUARE", widthMm: 50, heightMm: 50 },
      { shapeType: "CIRCLE", widthMm: 50, heightMm: 50 },
      { shapeType: "SQUARE", widthMm: 63, heightMm: 63 },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.shapeType, "SQUARE");
    assert.equal(rows[0]!.widthMm, 50);
  });
});
