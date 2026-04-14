## Step-by-step build sequence (tiny, mindless tasks)

### Phase 0 — Setup (Day 1–2)

- Create repo
- Setup frontend (Next.js)
- Setup backend (Node.js API)
- Setup PostgreSQL
- Connect backend ↔ database
- Setup cloud storage (for images)
- Setup Stripe account

---

### Phase 1 — Auth & users (Day 3–5)

- Create User model
- Add roles:
    - Admin (seller)
    - Staff (optional later)
- Build:
    - Signup page
    - Login page
    - Logout
- Add session handling (JWT or cookies)

✅ Checkpoint:

- User can create account and log in

---

### Phase 2 — Event system (Day 6–9)

### Backend

- Create Event model:
    - name
    - start_date
    - end_date
    - allowed_shapes
- Link Event → User

### Frontend (dashboard)

- “Create Event” page:
    - Input fields (name, dates)
    - Shape selection (checkboxes)
- Event list page

### Logic

- Block orders after end_date

✅ Checkpoint:

- Seller can create event and see it listed

---

## Phase 3 — Pricing system

- Pricing belongs to:
    - Event OR Storefront

### Validation rules

- Enforce one pricing mode per context:
    - If PER_ITEM → only one row allowed
    - If BUNDLE → allow multiple rows
    - Reject mixed configurations

### Backend

- Create Pricing model:
    - type: `per_item` or `bundle`
    - price
    - quantity (for bundles)

### Frontend

- Admin UI:
    - Add/edit pricing
    - Toggle between:
        - “Price per magnet”
        - “Bundles”

---

## Phase 4 — Storefront (monthly mode)

### Backend

- Create Storefront model:
    - name
    - owner_id
    - active = true

### Frontend

- Page:
    - “My Store Link”
    - Copy URL / QR
- Seller can:
    - View storefront link
    - Regenerate QR code

---

## Phase 5 — QR order flow (refined execution plan)

To avoid bugs and ensure pixel-perfect print accuracy, Phase 5 is implemented in atomic micro-steps.

### Phase 5A — Session layer (NO orders yet)

- One active session per device (cookie-based)
- Create OrderSession model
- QR entry → creates session
- Validate:
  - pricing exists
  - event is open / storefront active
- Store session in httpOnly cookie
- NO order creation yet

---

### Phase 5B — Shape + pricing selection

- User selects:
  - shape
  - quantity or bundle
- Live price calculation
- Still NO order

---

### Phase 5C — Image upload pipeline

- Upload images to storage
- Attach to session
- Validate resolution

---

### Phase 5D — Crop system (CRITICAL)

- Pixel-based crop (no %)
- Lock aspect ratio per shape
- Store crop coordinates
- Crop = print (strict rule)

IMPORTANT RULE:

- Crop coordinates are stored in pixels
- No percentages allowed
- Output must match print exactly

---

### Phase 5E — Review screen

- Show images
- Allow edit / delete

---

### Phase 5F — Order creation (FIRST COMMIT)

- Validate session is complete
- Create Order:
  - contextType
  - contextId
  - organizationId

- Copy SessionImages → OrderImages:
  - originalUrl
  - crop data
  - dimensions

- OrderImages are immutable

- Save pricing snapshot

---

### Phase 5G — Payment

- Event → cash
- Storefront → Stripe

✅ Checkpoint:

- Full order flow works end-to-end

---

## Phase 6 — Orders Dashboard (COMPLETED)

### Table view

* Columns:

  * Order ID (short version planned)
  * Customer name
  * Payment status (PAID / Pending)
  * Fulfillment status (Ready → Printed → Shipped)
  * Created time

### Features

* Pagination (basic)
* Search (basic)
* Mobile + desktop layout
* Order detail page

### Order detail page

* Images (grid)
* Print actions:

  * Print order (preview PDF)
  * Print selected (partial print)
* Fulfillment:

  * Mark as printed
  * Mark as shipped
* Customer & shipping info

✅ Checkpoint:

* Seller can find and act on any order in <5 seconds

---

## Phase 7 — Print System (CORE) (COMPLETED)

### Rendering pipeline

* SessionImages → OrderImages
* Cropping persisted (pixel accurate)
* Rendered images saved:

  * `/uploads/order-images-rendered/`

### PDF generation

* A4 layout (pixel-perfect)
* 6 magnets per page
* Fixed layout (no dynamic grid)
* Octagon cut guides:

  * Real cutter dimensions (70mm)
  * Correct line lengths
* Image size:

  * 50×50 mm (no distortion)

### Positioning

* Page split into two halves
* Each column centered
* Vertical alignment centered

### Advanced

* Multiple shapes supported (grouped PDFs)
* Vertical cut line (optional visual guide)

### Print flows

* Print preview (no DB changes)
* Print order (manual marking)
* Print selected (partial printing)

### Tracking

* OrderImage:

  * printed (boolean)
  * printedAt (timestamp)

* Order:

  * printedAt
  * shippedAt

✅ Checkpoint:

* Printed output matches real-world cutter perfectly

---

## Phase 8 — Payments & Order Flow (COMPLETED)

### Order lifecycle

1. Upload images
2. Crop images
3. Review
4. Create order (PENDING_PAYMENT / PENDING_CASH)
5. Customer info step
6. Payment (Stripe)
7. Webhook → mark PAID

### Stripe

* Checkout session
* Webhook handling
* Idempotent updates
* Session validation

### Email notifications

* Optional per event/storefront
* Sent AFTER customer info is saved
* Includes:

  * Name
  * Phone
  * Address
  * Image count
  * Total price
* Clean SaaS layout
* Dashboard link

### Storage strategy

* Original images → `/session-images`
* Order images → `/order-images`
* Rendered images → `/order-images-rendered`
* Print sheets → `/print-sheets`

✅ Checkpoint:

* Payment + order creation fully reliable

---

## Phase 9 — Fulfillment & Operations (CURRENT)

### Fulfillment model

* Status flow:

  * Ready to print
  * Printed
  * Shipped

### Seller actions

* Mark printed (full order)
* Print selected (auto mark selected)
* Mark shipped (after printed)

### Rules

* Cannot ship before printed
* Order printedAt set only when all images printed

### UX

* Dashboard buttons reflect state
* Visual badges for clarity

🔜 NEXT:

* Better filtering (Printed / Not printed)
* Bulk operations

---

## Phase 10 — Image Management (NEXT)

### Global image view

* Grid of all images across orders

### Filters

* Printed / Not printed
* By order
* By date

### Actions

* Reprint specific images
* Select multiple images → batch print

✅ Goal:

* Handle real-world printing mistakes easily

---

## Phase 11 — SaaS Layer (CRITICAL NEXT STEP)

### Multi-tenant foundation

* 1 storefront per organization ✅
* Events + storefront separation ✅

### To implement

* Organization dashboard
* Subscription model (Stripe Billing)
* Plan limits:

  * Number of events
  * Storage
  * Orders/month

### Billing

* Monthly subscription
* Usage tracking (optional later)

### Access control

* Owner / Staff roles
* Organization isolation

✅ Goal:

* Turn product into real SaaS business

---

## Phase 12 — Analytics (LATER)

### Dashboard metrics

* Orders per day
* Revenue
* Conversion rate
* Images per order

### Views

* Per event
* Per storefront

---

## Phase 13 — Data Export & Cleanup

### Export

* Orders → CSV
* Images → ZIP

### Cleanup

* Event:

  * Disable after end
  * Optional auto-delete

### Storefront

* Persistent data

---

## Timeline (updated reality)

* Phase 6–8 → DONE
* Phase 9 → In progress
* Phase 10 → Next
* Phase 11 → HIGH PRIORITY (SaaS monetization)

---

## Critical success rule (unchanged)

> If cropping is confusing → product fails
> If printing is wrong → business fails

Now also:

> If operations are slow → seller won’t use it
> If SaaS billing is unclear → you won’t make money
