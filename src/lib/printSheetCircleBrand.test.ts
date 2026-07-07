import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  circleBrandLabelRadius,
  computeCurvedBrandPlacements,
} from "../../server/src/lib/printSheetCircleBrand";
import { mm, printFrameSizeMm } from "../../server/src/lib/printSheetLayout";

describe("printSheetCircleBrand", () => {
  it("label radius sits inside circle 50×50 bleed frame", () => {
    const frame = printFrameSizeMm({
      shapeType: "CIRCLE",
      widthMm: 50,
      heightMm: 50,
    });
    const framePt = mm(frame.w);
    const labelR = circleBrandLabelRadius(framePt);
    assert.ok(labelR > 0);
    assert.ok(labelR < framePt / 2);
  });

  it("places characters along decreasing top arc angles (left to right)", () => {
    const text = "Magnetoo";
    const charWidths = text.split("").map(() => 5);
    const radius = 100;
    const placements = computeCurvedBrandPlacements(text, charWidths, radius);

    assert.equal(placements.length, text.length);
    for (let i = 1; i < placements.length; i++) {
      assert.ok(
        placements[i]!.angleRad < placements[i - 1]!.angleRad,
        `char ${i} should be to the right of char ${i - 1}`,
      );
    }

    const mid = placements[Math.floor(placements.length / 2)]!;
    assert.ok(Math.abs(mid.angleRad - Math.PI / 2) < 0.2);
  });
});
