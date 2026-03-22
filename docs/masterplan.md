## 30-sec elevator pitch

- SaaS for event-based **photo magnet sellers**
- Turns chaotic photo handling into a **smooth, fast workflow**
- Customers order via QR in seconds
- Sellers get **ready-to-print sheets instantly**
- Focus: **speed, accuracy, zero confusion**

---

## Problem & mission

- Problem:
  - Manual order taking = slow, messy
  - Image handling = inconsistent, error-prone
  - Printing workflow = biggest bottleneck
- Mission:
  - “From photo → printed magnet in minutes, without mistakes”

---

## Target audience

- Primary:
  - Event photographers
  - Wedding magnet vendors
  - Pop-up photo booth businesses
- Secondary:
  - Small print shops doing on-site events

---

## Business model

### Subscription types

- **Event-based**
  - Time-limited (e.g. 2–3 days)
  - Used for weddings, parties, pop-up events
  - Orders stop after event ends
- **Monthly (Storefront)**
  - Always-active ordering link
  - Seller shares via:
    - Instagram
    - Website
    - QR code
  - Continuous order intake

---

## Core features

### Pricing system

- Admin can:
  - Set price per magnet (e.g. $4 each)
  - OR define bundles (e.g. 3 for $10, 6 for $18)
  - System automatically calculates total price

### Customer (QR app)

- Scan QR → open order page instantly
- Choose:
  - Magnet shape (seller-defined)
  - Quantity
- See live price update based on selection
- Upload images:
  - Phone gallery
  - Google Drive
- Edit images:
  - Crop (critical)
  - Move/zoom
  - Delete/replace
- Checkout:
    - Event context:
        - Stripe (card, Apple Pay, Google Pay)
        - Cash (mark only)
    - Storefront context:
        - Stripe only

---

### Seller dashboard

- Event creation:
  - Name, location, duration
  - Allowed shapes/sizes
- Orders table:
  - Pagination
  - Search (name, order ID, status)
  - Payment status
- Image management:
  - All images across orders
  - Tagged with:
    - Order ID
    - Printed / Not printed
- Print workflow:
  - Select images
  - Generate **print-ready PDF**
  - Auto-mark as “Printed”
- Storefront:
  - Generate shareable link / QR
  - Manage always-active ordering

---

### Event lifecycle

- Buy event plan (e.g. 2–3 days)
- Event active:
  - Accept orders
- Event expired:
  - No new orders
  - Data export available
  - Auto-delete after defined period

---

### Storefront lifecycle

- Created under monthly subscription
- Always active
- Can receive orders continuously
- Can be paused (future)

---

## High-level tech stack (simple, practical)

- Frontend:
  - React / Next.js
  - Why: fast UI, great for mobile + dashboard
- Backend:
  - Node.js (API layer)
  - Why: handles uploads, orders, PDF generation
- Database:
  - PostgreSQL
  - Why: structured data (orders, users, events)
- Storage:
  - Cloud storage (e.g. S3)
  - Why: image-heavy system
- Payments:
  - Stripe
  - Why: simple + reliable
- Image processing:
  - Server-side image pipeline
  - Why: ensures **print accuracy**

---

## Conceptual data model (in plain English)

- User
  - email, role (admin, staff)
- Event
  - name, start/end date, allowed shapes
- Order
  - order_id, customer_name, payment_status
  - context_type: event | storefront
  - context_id
- Image
  - file_url, crop_data, shape, printed_flag
  - belongs to Order
- PrintBatch
  - list of images
  - generated_pdf

---

## UI design principles (Krug-first)

- “Don’t make me think” everywhere:
  - One primary action per screen
- Big buttons:
  - “Upload photo”
  - “Next”
- Always visible progress:
  - Step 1 → Upload
  - Step 2 → Crop
  - Step 3 → Pay
- Zero ambiguity:
  - Example: “Drag to move photo inside circle”

---

## Security & compliance

- Secure uploads (signed URLs)
- Stripe handles payment security
- Role-based access:
  - Admin vs staff
- Auto-delete event data (privacy-friendly)

---

## Phased roadmap

### MVP

- QR ordering
- Image upload + crop
- Orders dashboard
- Basic PDF generation

### V1

- Advanced crop (bleed, safe zones)
- Google Drive integration
- Better search/filter

### V2

- Analytics (orders per hour, revenue)
- Multi-user teams
- Templates for print sheets

---

## Risks & mitigations

- ❗ Complex image cropping
  - → Use proven cropping libraries + strict constraints
- ❗ Print mismatch (what user sees ≠ printed)
  - → Lock aspect ratios + preview with mask
- ❗ Slow uploads at events
  - → Compress + async upload

---

## Future expansion ideas

- White-label for large vendors
- Offline mode (sync later)
- Auto-face detection for cropping
- AI-enhanced photo positioning

