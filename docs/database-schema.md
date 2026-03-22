## Big picture (keep in mind)

- One unified system
- Orders belong to **event OR storefront**
- Images carry **print-critical data**
- Soft delete everywhere (`deleted_at`)

---

# 1. Core tables

---

## User

- id (uuid)
- email (unique)
- password_hash
- role (`ADMIN`, `STAFF`)
- stripe_customer_id (nullable)
- created_at
- updated_at
- deleted_at (nullable)

---

## Event

- id (uuid)
- user_id (FK → User)
- name
- start_date
- end_date
- is_active (boolean)
- created_at
- updated_at
- deleted_at (nullable)

---

## Storefront

- id (uuid)
- user_id (FK → User)
- name
- is_active (boolean)
- created_at
- updated_at
- deleted_at (nullable)

---

# 2. Pricing

---

## Pricing

- id (uuid)
- context_type (`event` | `storefront`)
- context_id (FK → Event or Storefront)
- type (`per_item` | `bundle`)
- price (decimal)
- quantity (nullable, for bundles)
- created_at
- updated_at
- deleted_at (nullable)

---

👉 Examples:

- per_item → price = 4, quantity = null
- bundle → price = 10, quantity = 3

---

# 3. Orders

---

## Order

- id (uuid)
- order_number (unique, human-readable)
- customer_name
- payment_status (`pending`, `paid`, `cash`, `failed`)
- total_price
- context_type (`event` | `storefront`)
- context_id
- created_at
- updated_at
- deleted_at (nullable)

---

👉 Notes:

- `cash` only allowed if context = event
- No FK constraint on context_id (polymorphic relation)

---

# 4. Images (CRITICAL TABLE)

---

## Image

- id (uuid)
- order_id (FK → Order)

### File data

- original_image_url
- original_image_width
- original_image_height

---

### Crop data (CRITICAL)

- crop_x (float, normalized)
- crop_y (float, normalized)
- zoom_level (float)
- rotation (float, default 0)

---

### Output config

- shape_type (`square`, `circle`, `rectangle`)
- output_width_px
- output_height_px

---

### Status

- printed_flag (boolean, default false)

---

### Metadata

- created_at
- updated_at
- deleted_at (nullable)

---

# 5. Print system

---

## PrintBatch

- id (uuid)
- user_id (FK → User)
- pdf_url
- created_at

---

## PrintBatchItem

- id (uuid)
- print_batch_id (FK → PrintBatch)
- image_id (FK → Image)

---

👉 Why separate table?

- One batch → many images
- Images can belong to different batches (future flexibility)

---

# 6. Allowed shapes (important for flexibility)

---

## AllowedShape

- id (uuid)
- context_type (`event` | `storefront`)
- context_id
- shape_type (`square`, `circle`, `rectangle`)
- width_mm
- height_mm

---

👉 Example:

- Square 50×50
- Rectangle 50×70

---

# 7. Relationships (simple view)

---

- User
    - has many Events
    - has many Storefronts
    - has many PrintBatches
- Event / Storefront
    - has many Orders
    - has many Pricing rules
    - has many AllowedShapes
- Order
    - has many Images
- Image
    - belongs to Order
    - belongs to many PrintBatchItems

---

# 8. Soft delete rules

---

## All main tables use:

- deleted_at (nullable timestamp)

---

## Behavior

- Never physically delete immediately
- Filter:
    - `WHERE deleted_at IS NULL`

---

## Exception

- Event cleanup job:
    - Can **hard delete after export period**

---

# 9. Indexing (IMPORTANT for performance)

---

## Add indexes:

- Order:
    - order_number
    - context_type + context_id
    - payment_status
- Image:
    - order_id
    - printed_flag
- Pricing:
    - context_type + context_id

---

# 10. Critical constraints (DO NOT BREAK)

---

- Order must have:
    - context_type + context_id
- Image must have:
    - crop data
    - original dimensions
- Pricing must belong to:
    - Event OR Storefront

---

# 11. Future-ready extensions (already supported)

---

- Multiple staff users ✅
- Advanced analytics ✅
- Re-print batches ✅
- AI crop suggestions ✅

---

# 🧠 Final mental model

- **Order = container**
- **Image = production unit**
- **PrintBatch = output action**