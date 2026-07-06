import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  effectiveImageDimensions,
  normalizeRotation,
  rotatedImageBBox,
  sharpRotateFromCropRotation,
} from "./cropRotation";
import { minCoverScale } from "./fixedFrameCropMath";

describe("cropRotation", () => {
  it("normalizeRotation wraps to 90° steps", () => {
    assert.equal(normalizeRotation(0), 0);
    assert.equal(normalizeRotation(90), 90);
    assert.equal(normalizeRotation(360), 0);
    assert.equal(normalizeRotation(450), 90);
    assert.equal(normalizeRotation(-90), 270);
    assert.equal(normalizeRotation(Number.NaN), 0);
  });

  it("effectiveImageDimensions swaps at 90° and 270°", () => {
    assert.deepEqual(effectiveImageDimensions(3000, 4000, 0), {
      w: 3000,
      h: 4000,
    });
    assert.deepEqual(effectiveImageDimensions(3000, 4000, 90), {
      w: 4000,
      h: 3000,
    });
    assert.deepEqual(effectiveImageDimensions(3000, 4000, 180), {
      w: 3000,
      h: 4000,
    });
    assert.deepEqual(effectiveImageDimensions(3000, 4000, 270), {
      w: 4000,
      h: 3000,
    });
  });

  it("sharpRotateFromCropRotation converts CW to Sharp CCW", () => {
    assert.equal(sharpRotateFromCropRotation(0), 0);
    assert.equal(sharpRotateFromCropRotation(90), 270);
    assert.equal(sharpRotateFromCropRotation(180), 180);
    assert.equal(sharpRotateFromCropRotation(270), 90);
  });

  it("rotatedImageBBox swaps at 90°", () => {
    const at0 = rotatedImageBBox(3000, 4000, 1, 0);
    assert.equal(at0.width, 3000);
    assert.equal(at0.height, 4000);

    const at90 = rotatedImageBBox(3000, 4000, 1, 90);
    assert.ok(Math.abs(at90.width - 4000) < 1e-6);
    assert.ok(Math.abs(at90.height - 3000) < 1e-6);
  });
});

describe("minCoverScale with rotation", () => {
  it("uses post-rotation dimensions for cover scale", () => {
    const scale0 = minCoverScale(300, 400, 2000, 3000, 0);
    const scale90 = minCoverScale(300, 400, 2000, 3000, 90);
    assert.equal(scale0, 0.15);
    assert.equal(scale90, 0.2);
  });
});
