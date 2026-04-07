## Dashboard layout (admin)

Layout:

- Top header:
  - App name (left)
  - User menu (right)

- Left sidebar:
  - Dashboard
  - Storefront (if enabled)
  - Events (if enabled)
  - Orders
  - (Future) Analytics

Rules:

- No mode switching
- Features shown based on capabilities

---

## Site map (top-level pages only)

### Customer (QR flow)

- **Entry Page**
  - Detects:
    - Event (time-limited)
    - Storefront (always active)
- Order Flow (multi-step)
  - Choose shape
  - Choose quantity (see price)
  - Upload
  - Crop
  - Review
  - Order summary
  - Payment
- Order Confirmation

---

### Seller (dashboard)

- Dashboard Home
- Events
- Orders
- Order Detail
- Images
- Print Queue
- Account / Settings

---

## Purpose of each page (one line, no fluff)

### Customer side

- **Entry Page**
  - Start order instantly (event or storefront)
- **Upload**
  - Add photos from device
- **Crop**
  - Adjust images to match magnet shape
- **Review**
  - Check, edit, or remove images
- **Order Summary**
  - Show final price and order details before payment
- **Payment**
    - Event:
        - Stripe or cash
    - Storefront:
        - Stripe only
- **Order Confirmation**
  - Show order ID + success message

---

### Seller side

- **Dashboard Home**
  - Quick overview (orders, status, activity)
- **Events**
  - Create and manage event plans
- **Orders**
  - Search, filter, and manage all orders
- **Order Detail**
  - View one order with all images
- **Images**
  - See all uploaded images across orders
- **Print Queue**
  - Select images → generate print PDF
- **Account / Settings**
  - Manage profile, billing, preferences
- **Storefront**
  - Manage always-on ordering link

---

## User roles

- SaaS Owner (you)
  - manages platform (outside dashboard)

- Client (Organization admin)
  - manages:
    - storefront
    - events
    - orders

- Staff (optional)
  - limited access (future)

- Customer (end-user)
  - anonymous
  - creates orders via QR / link

---

## Context-based behavior

- Orders always belong to:
  - event OR storefront

- UI adapts automatically:
  - Event → allows cash
  - Storefront → Stripe only

---

## Primary user journeys (max 3 steps each)

### 1. Customer creates order (critical path)

1. Open link (QR or URL)
2. Configure order (shape + quantity + upload + crop photos)
3. Pay → receive order ID

---

### 2. Seller processes orders

1. Open Orders page → find order
2. Review images
3. Move to print queue

---

### 3. Seller prints magnets (core workflow)

1. Open Images / Print Queue
2. Select images → generate PDF
3. Download → print → auto-mark as printed

---

### 4. Seller creates event

1. Go to Events → “Create Event”
2. Set name, duration, shapes
3. Get QR → start selling

---

### 5. Seller closes event

1. Event expires automatically
2. Export images + orders
3. System deletes event data

---

### 6. Seller uses storefront

1. Open Storefront page
2. Copy link / QR
3. Share → start receiving orders

---

## Key flow rules (make or break UX)

- Customer flow:
  - Linear only (no branching confusion)
  - Always show “Next”
- Seller flow:
  - Everything reachable in ≤ 3 clicks
- Print flow:
  - Selection → PDF → Done
  - No hidden steps

---

## Final clarity check

If a new user opens the product:

- Customer should think:
  - “Upload → adjust → pay. Easy.”
- Seller should think:
  - “Find order → print → done.”

If that’s true → product succeeds.