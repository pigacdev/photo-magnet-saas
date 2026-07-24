# Mobile Review Crop Preview Fix

**Date:** 2026-07-23  
**Status:** Approved

## Problem

On order Step 4 (`/order/review`), the cropped magnet preview changed when resizing the viewport. Edit crop and the generated preview PDF showed the correct crop — only the Review presentation was wrong.

## Root causes

1. **Mid-width layout (450–770px):** Canvas was capped at 384px while the wrapper could grow to 448px (`max-w-md`), so frame and bitmap diverged and content clipped.
2. **Resize changes crop (critical):** A later attempt reused pan/zoom UI fields (`cropTranslateX/Y`, `cropScale`) for review. Those values are in **crop-editor frame CSS pixels** and depend on frame size at save time — resizing the review frame re-framed the image.

## Solution

Review preview must draw the **stored pixel crop rect** (`cropX/Y/Width/Height` + `cropRotation`) — same data as print/PDF. Resize only scales the bitmap; crop content stays fixed.

1. `CroppedShapePreview` uses `drawPostRotationCrop` on a canvas (Sharp-compatible path).
2. Wrapper defines shape aspect ratio; canvas is `absolute` and paints to measured `clientWidth` × `clientHeight`.
3. **Never** use `cropTranslateX/Y` or `cropScale` for Step 4 display.
4. Remove duplicate `overflow-hidden` on the review card link; clip on the preview frame only.

## Out of scope

- `FixedCropCanvas` / crop save math
- Print / PDF rendering
- OrderShell breakpoints or review grid columns

## Verification

- Resize ~328 → ~760 → ~900px on Review: same crop content, only scale changes.
- At `md` 2-col: desktop layout unchanged.
- Edit crop and preview PDF still match the intended crop.
