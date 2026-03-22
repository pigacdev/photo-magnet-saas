## Emotional tone

**Feels like a calm, high-end print studio—fast, precise, and quietly confident.**

- No chaos, no clutter
- Every action feels **intentional and guided**
- Users feel:
    - In control (seller)
    - Effortless (customer)

---

## Visual system

### Typography

**Goal:** Clear, modern, zero friction

- Primary font:
    - Inter (clean, highly readable)
- Hierarchy:
    - H1 → 32px / Semi-bold
        - Example: “Create your order”
    - H2 → 24px / Medium
        - Example: “Upload photos”
    - H3 → 18px / Medium
    - Body → 16px / Regular
    - Caption → 13px / Regular
- Rules:
    - Line height ≥ 1.5
    - Avoid long paragraphs
    - One idea per line

---

### Color system

**Mood:** Neutral, slightly premium, non-distracting

- Primary:
    - #111111 (near black)
- Secondary:
    - #6B7280 (soft gray)
- Background:
    - #FFFFFF (white)
    - #F9FAFB (light gray)
- Accent (action color):
    - #2563EB (blue)
    - Used for:
        - Buttons
        - Active states
- Success:
    - #16A34A (green)
- Warning:
    - #F59E0B (orange)
- Error:
    - #DC2626 (red)

**Rules:**

- Contrast ≥ 4.5:1
- No more than 2 accent colors per screen

---

### Spacing & layout

**System:** 8pt grid

- Spacing scale:
    - 8 / 16 / 24 / 32 / 48
- Layout rules:
    - Mobile-first for customer flow
    - Max width for dashboard: 1200px
    - Generous padding:
        - Cards: 16–24px
        - Sections: 32px+
- Example:
    - Upload screen:
        - Big drop area
        - Clear spacing between thumbnails

---

## Motion & interaction

**Tone:** Gentle, supportive, never flashy

- Duration:
    - 150–200ms (standard)
    - Up to 250ms for modals only
- Easing:
    - Ease-out (smooth stop)

---

### Key interactions

- Button hover:
    - Slight scale (1.02)
- Image crop:
    - Smooth drag
    - No lag
- Modal:
    - Slide up softly

---

### Emotional moments

- Upload success:
    - Subtle fade-in thumbnail
- Order complete:
    - Calm confirmation (no confetti spam)

---

## Core UX patterns

### 1. “One task per screen” (critical)

### Customer flow:

- Screen 1 → Start
- Screen 2 → Choose shape
- Screen 3 → Choose quantity (see live price)
- Screen 4 → Upload
- Screen 5 → Crop
- Screen 6 → Review images
- Screen 7 → Order summary (price, quantity, details)
- Screen 8 → Pay

👉 Never mix steps

---

### 2. Cropping experience (MOST IMPORTANT)

**Must feel obvious instantly**

- Always show:
    - Shape mask (circle, square, etc.)
- User actions:
    - Drag = move image
    - Pinch/scroll = zoom
- Add helper text:
    - “Drag to position your photo”
- Show bleed-safe area:
    - Subtle inner border
- Image must always fully cover shape
- No empty/white areas allowed

---

### 3. Image grid (seller side)

- Clean grid layout
- Each image card shows:
    - Thumbnail
    - Order ID
    - Status:
        - “Printed” (green badge)
        - “Not printed” (gray badge)

---

### 4. Tables (orders)

- Keep columns minimal:
    - Order ID
    - Name
    - Status
    - Time
- Sticky header
- Search always visible

---

### 5. Pricing visibility (critical)

- Always visible before payment
- Updates instantly when:
    - Quantity changes
    - Bundle selected

👉 Example:

“6 magnets — $18”

- Payment methods adapt to context:
    - Event → cash option visible
    - Storefront → no cash option shown

---

## Loading & feedback states

- Show loading indicator during:
    - Image upload
    - Payment processing
- Never leave user guessing

👉 Example:

“Uploading photo…”

---

## Error handling (kind UX)

- Allow user to:
    - Re-upload image easily
    - Go back without losing progress
- Never blame user

👉 Example:

“Something went wrong. Let’s try again.”

---

## Voice & tone

**Personality:**

- Calm
- Clear
- Slightly friendly
- Never technical

---

### Microcopy examples

**Onboarding**

- “Start your order in seconds”

**Success**

- “Order received. We’ll take it from here.”

**Error**

- “Upload failed. Try again.”

---

## System consistency

- Use repeated patterns:
    - Same buttons everywhere
    - Same card style
- Reference:
    - Linear (clean dashboards)
    - Apple UI (calm, confident)
    - shadcn/ui (component consistency)

---

## Accessibility

- Keyboard navigation (dashboard)
- Focus states clearly visible
- Buttons ≥ 44px height (mobile)
- Alt text for images (basic)

---

## Emotional audit checklist

- Does the UI feel calm or rushed?
- Are users guided without thinking?
- Does cropping feel natural in <5 seconds?

---

## Technical QA checklist

- Typography follows scale
- Colors meet contrast
- Interactive states visible
- Motion ≤ 300ms

---

## Design snapshot

### Color palette

```
Primary:   #111111
Secondary: #6B7280
Background:#FFFFFF
Surface:   #F9FAFB
Accent:    #2563EB
Success:   #16A34A
Warning:   #F59E0B
Error:     #DC2626
```

---

### Typography scale

- H1 → 32px / Semi-bold
- H2 → 24px / Medium
- H3 → 18px / Medium
- Body → 16px
- Caption → 13px

---

### Spacing system

- Base unit: 8px
- Common spacing:
    - 16px (tight)
    - 24px (standard)
    - 32px (sections)

---

### Pricing clarity (important)

- Always show:
    - Selected quantity
    - Total price (live update)

---

### Emotional thesis

**“A calm, precise workspace that makes complex photo handling feel effortless.”**

---

## Design Integrity Review

The system strongly aligns with the goal: **clarity + speed without stress**.

Cropping and printing workflows are supported with minimal friction.

**Improvement suggestion:**

- Add **real-time print preview overlay** during cropping to further reduce uncertainty and boost trust.