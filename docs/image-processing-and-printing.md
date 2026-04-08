## Big rule (never break this)

> What user sees in crop = what gets printed
> 

No approximations. No resizing later.

---

# 1. Core print standards

- DPI: **300**
- Color: RGB (convert later if needed)
- Units: **millimeters (mm)**
- All pixel values must be rounded to nearest integer
- Avoid pure black (0,0,0); use rich black if needed
- Convert to printer profile if required (future)

---

## Example sizes (convert once, reuse everywhere)

| Shape | Size (mm) | Pixels @300 DPI |
| --- | --- | --- |
| Square small | 50×50 mm | 591×591 px |
| Square large | 63×63 mm | 744×744 px |
| Rectangle | 50×70 mm | 591×827 px |

👉 Formula:

```
pixels = (mm / 25.4) * 300
```

---

# 2. Crop system (PIXEL-PERFECT)

## Mental model

- Frame = fixed (shape size)
- Image = moves inside frame

👉 User never resizes frame

---

## 2.1 Shape masks

### Supported:

- Square
- Circle
- Rectangle

---

### Behavior

- Mask is always visible
- Outside area = dark overlay (60–70% opacity)

👉 This removes all confusion instantly

---

## 2.2 Crop container

- Aspect ratio locked to shape

Examples:

- Square → 1:1
- Rectangle → fixed ratio
- Circle → internally 1:1 (just masked)

---

## 2.3 Image interaction

### Drag

- Moves image inside frame

### Zoom

- Pinch (mobile)
- Scroll (desktop)

---

## 2.4 Zoom rules (VERY IMPORTANT)

### Minimum zoom

- Image MUST fully cover frame

👉 No empty space allowed

### Coverage rule (CRITICAL)

- Image must always fully cover the frame
- No empty/transparent areas allowed

If coverage is not met:

- Prevent user from continuing

---

### Maximum zoom

- 3x–4x max

👉 Prevent:

- Pixelation
- Over-zoom confusion

---

## 2.5 Drag boundaries

- User cannot drag image outside frame coverage

👉 Always enforce:

- Frame fully filled

---

## 2.6 Bleed handling (CRITICAL)

### Add bleed:

- **+2mm on all sides**

Example:

- Final: 50×50 mm
- With bleed: **54×54 mm**

---

### Crop behavior

- Show:
    - Outer edge (bleed area)
    - Inner “safe zone” (subtle guide)

---

### Visual guides

- Outer line → print edge
- Inner line → safe area

👉 Example helper text:

- “Keep faces inside inner area”

---

## 2.7 Data to store (IMPORTANT)

### Crop coordinate system (CRITICAL)

- crop_x, crop_y represent the image position relative to frame center
- Values are stored in normalized units (0–1) OR pixels (must be consistent)

👉 Recommended:

- Use normalized values (0–1)

Example:

- crop_x: 0 = centered
- crop_x: -0.5 = moved left
- crop_y: 0.3 = moved down

For each image:

- original_image_url
- original_image_width
- original_image_height
- crop_x
- crop_y
- zoom_level
- rotation (degrees, optional future)
- shape_type
- output_width_px
- output_height_px

---

👉 Example:

```
{
  "crop_x": 0,
  "crop_y": 0,
  "zoom": 1.8,
  "shape": "circle",
  "output_width_px": 591,
  "output_height_px": 591
}
```

---

## 2.8 Rendering rule (non-negotiable)

> NEVER crop visually only
> 

Always:

- Re-render final image server-side using crop data

---

# 3. Image processing pipeline

- Normalize image orientation (EXIF) before processing

## Step-by-step

1. User uploads image
2. Store original (full resolution)
3. Save crop data
4. On print:
    - Apply crop
    - Render cropped area directly to target dimensions (no stretching)
    - Apply mask (if needed)

---

## Output result

- Perfectly sized
- No scaling needed in PDF

---

# 4. PDF print generation (CORE SYSTEM)

## Magnet image sequence (position)

- Each magnet in a session or committed order has integer **`position`** (display / print order: magnet 1 → 2 → 3).
- **Server:** any query that returns multiple `SessionImage` or `OrderImage` rows must use **`ORDER BY position ASC, createdAt ASC`** (tie-break). Shared constants: `SESSION_IMAGE_LIST_ORDER_BY` and `ORDER_IMAGE_LIST_ORDER_BY` in `server/src/lib/magnetImageOrderBy.ts`.
- **Client:** when re-sorting API payloads, use the same rule (`src/lib/magnetImageSort.ts`).

## 4.1 Sheet basics

- Format: A4 (default)
    - 210 × 297 mm
- DPI: 300
- Pixel size:
    - 2480 × 3508 px
- All layout calculations use millimeters (mm)
- Pixels are used only for image rendering
- No pixel-based positioning in PDF layout

---

## 4.2 Layout logic

### Grid calculation (deterministic)

- Input:
    - item_width_mm (with bleed)
    - item_height_mm (with bleed)
    - page_width_mm
    - page_height_mm
    - spacing_mm
- Calculate:
    - usable_width = page_width - (2 × margin)
    - usable_height = page_height - (2 × margin)
    - columns = floor(usable_width / (item_width + spacing))
    - rows = floor(usable_height / (item_height + spacing))
- Total per page = columns × rows

### Page margins (CRITICAL)

- Add minimum margin:
    - 5–10 mm on all sides
- No images placed inside margin area

---

## 4.3 Spacing

- Between items:
    - 2–4 mm

👉 Prevent cutting issues

---

## 4.4 Placement rules

- Always align to grid
- No rotation (unless future feature)
- Placement starts from top-left corner inside margins
- Fill rows left → right, then top → bottom

---

## 4.5 Multi-image batching

### Input:

- Selected images (any number)

### Output:

- Multiple PDFs if needed

---

👉 Example:

- 25 images
    
    → 20 on page 1
    
    → 5 on page 2
    

---

## 4.6 Shape rendering

### Square / rectangle

- Normal image

### Circle

- Apply vector clipping path (circle)
- Do NOT rasterize edges (prevents jagged edges)

👉 Important:

- Background must be transparent OR white (printer-safe)

---

## 4.7 Print marks (recommended)

- Optional:
    - Cut lines (light gray)
    - Margins

---

## 4.8 File output

- Format: PDF
- Resolution: 300 DPI
- Filename:
    - `eventName_batch_01.pdf`

---

## 4.9 After generation

- Mark images:
    - printed = true

---

# 5. Print workflow (end-to-end)

1. Seller selects images
2. Click “Generate PDF”
3. System:
    - Applies crops
    - Generates sheets
4. Seller downloads PDF
5. Images marked as printed

---

# 6. Edge cases (handle these)

### Resolution validation

- Calculate effective DPI:

effective_dpi = original_image_pixels / (print_size_mm / 25.4)

- If < 200 DPI:

show warning

---

### Low resolution image

- Warn user:
    - “Image may print blurry”

---

### Wrong aspect ratio

- Already handled via crop lock

---

### Too many images

- Auto split into multiple PDFs

---

# 7. Performance rules

- Never process images on client for final output
- Use server-side processing
- Cache processed images if reused

---

# 8. Critical success checklist

- Crop = print (perfect match)
- No white edges
- No stretched images
- No manual resizing in print shop

---

# Final truth

> This system is not UI—it’s production logic
> 

If done right:

- Sellers trust it instantly
- Workflow becomes **10x faster**

If wrong:

- Prints fail → product fails