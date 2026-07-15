import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SHAPE_PRESET_VALUES,
  getShapePresets,
  isProductionValidatedShape,
  productionValidatedShapeKeys,
} from "./shapePresets";
import { isProductionValidatedShape as serverIsProductionValidatedShape } from "../../server/src/lib/validatedShapes";

describe("shapePresets production validation", () => {
  it("only the 2x2 in (50x50 mm) square is production-validated", () => {
    const validated = SHAPE_PRESET_VALUES.filter((s) => s.productionValidated);
    assert.equal(validated.length, 1);
    assert.deepEqual(
      { shapeType: validated[0]!.shapeType, widthMm: validated[0]!.widthMm, heightMm: validated[0]!.heightMm },
      { shapeType: "SQUARE", widthMm: 50, heightMm: 50 },
    );
  });

  it("isProductionValidatedShape matches the preset flag for every preset", () => {
    for (const preset of SHAPE_PRESET_VALUES) {
      assert.equal(
        isProductionValidatedShape(preset),
        preset.productionValidated,
        `client mismatch for ${preset.shapeType} ${preset.widthMm}x${preset.heightMm}`,
      );
    }
  });

  it("client and server allowlists agree for every preset", () => {
    for (const preset of SHAPE_PRESET_VALUES) {
      assert.equal(
        serverIsProductionValidatedShape(preset),
        isProductionValidatedShape(preset),
        `server/client mismatch for ${preset.shapeType} ${preset.widthMm}x${preset.heightMm}`,
      );
    }
  });

  it("rejects unknown / non-validated shapes", () => {
    assert.equal(
      isProductionValidatedShape({ shapeType: "CIRCLE", widthMm: 50, heightMm: 50 }),
      false,
    );
    assert.equal(
      isProductionValidatedShape({ shapeType: "SQUARE", widthMm: 63, heightMm: 63 }),
      false,
    );
    assert.equal(
      isProductionValidatedShape({ shapeType: "SQUARE", widthMm: 99, heightMm: 99 }),
      false,
    );
  });

  it("getShapePresets marks only validated shapes as available", () => {
    const presets = getShapePresets("mm");
    const available = presets.filter((p) => p.available);
    assert.equal(available.length, 1);
    assert.equal(available[0]!.value.shapeType, "SQUARE");
    assert.equal(available[0]!.value.widthMm, 50);
  });

  it("productionValidatedShapeKeys ignores legacy unvalidated rows", () => {
    const keys = productionValidatedShapeKeys([
      { shapeType: "SQUARE", widthMm: 50, heightMm: 50 },
      { shapeType: "CIRCLE", widthMm: 50, heightMm: 50 },
      { shapeType: "RECTANGLE", widthMm: 50, heightMm: 70 },
    ]);
    assert.equal(keys.size, 1);
    assert.equal(keys.has("SQUARE-50-50"), true);
  });
});
