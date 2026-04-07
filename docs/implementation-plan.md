## Step-by-step build sequence (tiny, mindless tasks)

### Phase X — SaaS foundation (multi-tenant)

- Create Organization model
- Link User → Organization
- Link:
  - Event → Organization
  - Storefront → Organization
  - Order → Organization

- Add capabilities:
  - hasStorefront (boolean)
  - eventCredits (int)

- Enforce:
  - 1 storefront per organization
  - events require available credits

---

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

### Phase 6 — Orders dashboard (Day 17–20)

### Table view

- Columns:
    - Order ID
    - Customer name
    - Payment status
    - Created time

### Features

- Pagination
- Search:
    - by name
    - by order ID
    - by status

### Order detail page

- Show:
    - Images
    - Payment info

✅ Checkpoint:

- Seller can find any order in <5 seconds

---

### Phase 7 — Image management (Day 21–24)

### Global image page

- Grid of all images
- Each image shows:
    - Order ID
    - Printed / Not printed

### Filters

- Show:
    - Only not printed
    - Only printed

### Data model update

- Add:
    - printed_flag (true/false)

✅ Checkpoint:

- Seller sees all images clearly grouped

---

### Phase 8 — Print sheet generator (CORE FEATURE) (Day 25–30)

### Selection

- Checkbox on each image

### Generate PDF

- Input:
    - Selected images
- Output:
    - PDF with:
        - Correct size
        - Correct shape
        - Proper spacing

### Layout rules (example)

- 2x2 magnets:
    - Grid layout
- Circle:
    - Mask applied

### After generation

- Mark images as:
    - printed = true

👉 Example:

- Select 3 images → download PDF → those 3 become “Printed”

✅ Checkpoint:

- Seller can print batch in 1 click

---

### Phase 9 — Data export & cleanup (Day 31–33)

### Export

- Download:
    - All images (ZIP)
    - Orders (CSV)

### Auto-clean

- After event ends:
    - Disable new orders
    - Schedule deletion

✅ Checkpoint:

- Seller can safely close event

### Storefront data

- No auto-delete
- Seller can export data anytime

---

## Timeline with checkpoints (simple view)

- Week 1 → Auth + Events
- Week 2 → Customer ordering flow
- Week 3 → Dashboard + images
- Week 4 → Print system + polish

---

## Team roles (lean setup)

### 1. Product/Founder (you)

- Defines flows
- Tests usability weekly

### 2. Frontend dev

- Customer UI (mobile-first)
- Dashboard UI

### 3. Backend dev

- API
- Image processing
- PDF generation

### 4. Designer (optional but powerful)

- Cropping UX (very important)
- Visual clarity

---

## Recommended rituals

- Weekly:
    - 30-min usability test (3 users)
    - Ask:
        - “Where did you hesitate?”
        - “What confused you?”
- Daily:
    - Ship small features
    - Avoid big rewrites

---

## Optional integrations & stretch goals

### Nice-to-have (early)

- Google Drive upload
- Email confirmation (order receipt)

### Later (high impact)

- AI auto-crop suggestion (center faces)
- Analytics dashboard:
    - Orders/hour
    - Revenue

### Advanced

- Multi-event dashboard
- White-label mode

---

## Critical success rule

> If cropping is confusing → product fails
> 
> 
> If printing is wrong → business fails
> 

So:

- Invest extra time in:
    - Crop UX
    - Print accuracy