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
- clerk_id (unique, nullable — Clerk external user id)
- email (unique)
- password_hash (nullable — legacy only)
- role (`ADMIN`, `STAFF`)
- stripe_customer_id (nullable)
- created_at
- updated_at
- deleted_at (nullable)

---

## Organization

Seller tenant (1:1 with User; `id` = `user.id`). Billing limits + magnet order currency.

- id (uuid, same as user id)
- plan (`FREE`, `HOBBY`, `PRO`)
- orders_this_month, order_limit, events_created_this_month, event_limit, billing period fields
- clerk_plan_slug (nullable)
- **currency** (ISO 4217 alpha-3, nullable until onboarding — magnet pricing/analytics only; independent of Clerk subscription USD billing)
- **initial_setup_at** (nullable — set when currency first saved)
- **date_format** (`DMY` | `MDY` | `YMD`, nullable — UI display only; does not affect stored dates)
- **size_unit** (`mm` | `cm` | `in`, nullable — UI display only; shape dimensions remain stored in mm)
- **name** (nullable — seller business/shop display name; used in customer email branding)
- stripe_customer_id, clerk_subscription_id (nullable)
- **is_early_access** (boolean, default false)
- **early_access_expires_at** (nullable — 60-day launch window end)
- **grant_lifetime_discount** (boolean, default false — platform owner toggle)
- **early_access_heads_up_sent_at** (nullable — dedupe 7-day notice email)
- **subscription_lapse_notified_at** (nullable — dedupe subscription-lapse email; cleared on paid resubscribe)

---

## EarlyAccessCounter

Singleton row (`id = 1`) for launch seat tracking.

- id (int, always 1)
- seats_taken (int, default 0)
- plans_flipped_at (nullable — when early plans were hidden in Clerk)

---

## Event

- id (uuid)
- user_id (FK → User)
- name
- start_date
- end_date
- is_active (boolean)
- brand_text (nullable, max 40 chars)
- banner_url (nullable — public entry page banner image URL)
- notification_email (nullable)
- send_order_emails (boolean)
- max_magnets_per_order (nullable)
- created_at
- updated_at
- deleted_at (nullable)

---

## Storefront

- id (uuid)
- user_id (FK → User)
- name
- is_active (boolean)
- max_magnets_per_order (nullable)
- brand_text (nullable, max 40 chars)
- notification_email (nullable)
- send_order_emails (boolean)
- **pickup_address** (JSON, nullable — structured: street, house_number, city, post_code, country)
- **vacation_from** (nullable — inclusive UTC date; Hobby+ vacation mode)
- **vacation_to** (nullable — inclusive UTC date; Hobby+ vacation mode)
- **vacation_note** (nullable, max 500 chars — shown on public storefront during vacation)
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
- **currency** (ISO 4217, copied from Organization at write time)
- quantity (nullable, for bundles)
- created_at
- updated_at
- deleted_at (nullable)

---

👉 Examples:

- per_item → price = 4, quantity = null
- bundle → price = 10, quantity = 3

---

## Customer

Seller CRM record for buyers (Pro plan feature). Created or updated at order commit from checkout Step 5 (Details). Scoped to Organization.

- id (uuid)
- organization_id (FK → Organization)
- name
- email (nullable)
- phone (nullable)
- created_at — set to earliest linked order at backfill; new customers at first order
- updated_at
- deleted_at (nullable — soft delete; hidden from Customers page; does not alter order snapshots)

👉 Matching rule within org: email (case-insensitive) first, then normalized phone.

---

# 3. Orders

---

## Order

- id (uuid)
- organization_id (FK → Organization)
- **customer_id** (nullable FK → Customer — CRM link at commit; `ON DELETE SET NULL`)
- customer_name, customer_email, customer_phone — **immutable snapshot** at order commit
- status (order workflow: NEW, CONFIRMED, …)
- total_price
- **currency** (ISO 4217 snapshot at order commit)
- context_type (`event` | `storefront`)
- context_id
- shipping_type, shipping_address (storefront)
- created_at
- updated_at

---

👉 Notes:

- Order buyer fields are snapshots; editing on order detail updates the order row only
- Deleting a Customer soft-deletes the CRM row; linked orders keep their snapshot fields
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
- Rectangle 50×76

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
- Pricing mode must be exclusive per context:
    - A context (event or storefront) can have:
        - ONLY `per_item`
        - OR ONLY `bundle`
    - Mixing both types is NOT allowed
    - If `per_item` exists → only one row allowed
    - If `bundle` exists → one or more rows allowed
- Cash payment:
    - Allowed ONLY when context_type = event

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