import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCircleOrderShape,
  orderImageThumbSize,
} from "./orderImageThumbSize";

describe("orderImageThumbSize", () => {
  it("uses square thumbs for circle and square shapes", () => {
    for (const shapeType of ["SQUARE", "CIRCLE"]) {
      const size = orderImageThumbSize({
        shapeType,
        widthMm: 50,
        heightMm: 50,
      });
      assert.equal(size.width, 132);
      assert.equal(size.height, 132);
    }
  });

  it("uses portrait thumb for rectangle 50×70", () => {
    const size = orderImageThumbSize({
      shapeType: "RECTANGLE",
      widthMm: 50,
      heightMm: 70,
    });
    assert.equal(size.height, 132);
    assert.equal(size.width, 94);
  });

  it("detects circle shape type", () => {
    assert.equal(
      isCircleOrderShape({ shapeType: "CIRCLE", widthMm: 50, heightMm: 50 }),
      true,
    );
    assert.equal(
      isCircleOrderShape({ shapeType: "SQUARE", widthMm: 50, heightMm: 50 }),
      false,
    );
  });
});
