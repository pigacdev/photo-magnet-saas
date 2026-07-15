import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computePrintGrid,
  isLegacySquare50Layout,
  printFrameSizeMm,
  printImageSizeMm,
  type PrintSheetShape,
} from "../../server/src/lib/printSheetLayout";

describe("printSheetLayout", () => {
  it("identifies legacy Square 50×50 only", () => {
    assert.equal(
      isLegacySquare50Layout({
        shapeType: "SQUARE",
        widthMm: 50,
        heightMm: 50,
      }),
      true,
    );
    assert.equal(
      isLegacySquare50Layout({
        shapeType: "SQUARE",
        widthMm: 63,
        heightMm: 63,
      }),
      false,
    );
    assert.equal(
      isLegacySquare50Layout({
        shapeType: "CIRCLE",
        widthMm: 50,
        heightMm: 50,
      }),
      false,
    );
  });

  it("applies +2 mm bleed per axis for all catalog shapes", () => {
    const cases: PrintSheetShape[] = [
      { shapeType: "SQUARE", widthMm: 50, heightMm: 50 },
      { shapeType: "SQUARE", widthMm: 63, heightMm: 63 },
      { shapeType: "CIRCLE", widthMm: 57, heightMm: 57 },
      { shapeType: "RECTANGLE", widthMm: 50, heightMm: 76 },
    ];
    for (const shape of cases) {
      const size = printImageSizeMm(shape);
      assert.equal(size.w, shape.widthMm + 2);
      assert.equal(size.h, shape.heightMm + 2);
    }
  });

  it("computes at least one slot per page for catalog print sizes", () => {
    const cases: PrintSheetShape[] = [
      { shapeType: "SQUARE", widthMm: 63, heightMm: 63 },
      { shapeType: "CIRCLE", widthMm: 57, heightMm: 57 },
      { shapeType: "RECTANGLE", widthMm: 50, heightMm: 76 },
    ];
    for (const shape of cases) {
      const frame = printFrameSizeMm(shape);
      const grid = computePrintGrid(frame.w, frame.h);
      assert.ok(grid.slotsPerPage >= 2);
      assert.equal(grid.cols, 2);
      assert.ok(grid.rows >= 1);
    }
  });

  it("outer frame matches legacy Square 50×50 margin for Circle 57×57", () => {
    const frame = printFrameSizeMm({
      shapeType: "CIRCLE",
      widthMm: 57,
      heightMm: 57,
    });
    assert.equal(frame.w, frame.h);
    const bleedImageMm = 57 + 2;
    const legacyPadMm = 31 * (1 + Math.SQRT2) - 52;
    assert.ok(Math.abs(frame.w - (bleedImageMm + legacyPadMm)) < 0.01);
  });

  it("rectangle frame is taller than wide with octagon margin", () => {
    const frame = printFrameSizeMm({
      shapeType: "RECTANGLE",
      widthMm: 50,
      heightMm: 76,
    });
    assert.ok(frame.h > frame.w);
    assert.equal(frame.w, 52 + 2 * ((31 * (1 + Math.SQRT2) - 52) / 2));
  });

  it("fits rectangle 50×76 frame on A4 with multiple rows", () => {
    const frame = printFrameSizeMm({
      shapeType: "RECTANGLE",
      widthMm: 50,
      heightMm: 76,
    });
    const grid = computePrintGrid(frame.w, frame.h);
    assert.equal(grid.rows, 2);
    assert.equal(grid.slotsPerPage, 4);
  });
});
