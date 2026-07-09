import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countUnprintedImages,
  orderIsFullyPrinted,
  orderNeedsPrintingAttention,
} from "./orderPrintProgress";

describe("orderPrintProgress", () => {
  it("ignores media-deleted rows when counting unprinted", () => {
    const images = [
      { printed: false, mediaDeletedAt: null },
      { printed: false, mediaDeletedAt: new Date() },
      { printed: true, mediaDeletedAt: null },
    ];
    assert.equal(countUnprintedImages(images), 1);
  });

  it("excludes NEW orders from needs-printing attention", () => {
    const images = [{ printed: false, mediaDeletedAt: null }];
    assert.equal(orderNeedsPrintingAttention("NEW", images), false);
  });

  it("includes partial PAID orders in needs-printing attention", () => {
    const images = [
      { printed: true, mediaDeletedAt: null },
      { printed: false, mediaDeletedAt: null },
    ];
    assert.equal(orderNeedsPrintingAttention("PAID", images), true);
  });

  it("excludes fully printed orders from needs-printing attention", () => {
    const images = [
      { printed: true, mediaDeletedAt: null },
      { printed: true, mediaDeletedAt: null },
    ];
    assert.equal(orderNeedsPrintingAttention("PAID", images), false);
    assert.equal(orderIsFullyPrinted(images), true);
  });

  it("treats zero printable images as not fully printed", () => {
    const images = [{ printed: false, mediaDeletedAt: new Date() }];
    assert.equal(orderIsFullyPrinted(images), false);
    assert.equal(orderNeedsPrintingAttention("PAID", images), false);
  });
});
