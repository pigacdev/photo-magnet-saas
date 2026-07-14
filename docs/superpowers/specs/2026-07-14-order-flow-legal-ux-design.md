# Order flow legal UX — design spec

**Date:** 2026-07-14  
**Status:** Approved

## Problem

Three UX issues in the buyer order flow:

1. **Start order** button sits flush against the legal footer separator on event/store entry pages.
2. No **retention notice** before submit — buyers are not told how long order images are kept.
3. **Legal footer links** during checkout navigate in the same tab; legal pages only offer “Back to home”, losing in-progress orders.

## Solution

### 1. Content spacing above footer

Add `pb-8` to the main content wrapper in `OrderShell` so all order-flow pages have margin above the footer border.

### 2. Image retention notice (customer step)

On `src/app/order/customer/page.tsx`, show an informational paragraph **before** the consent checkbox when placing a new order (`!isSubmittedOrderEdit`):

- Copy mentions **uploaded photos / order image files only** (not PII).
- Retention period from `LEGAL_RETENTION_DEFAULTS.orderMediaDays` (30 days, mirrors Privacy Policy).
- Privacy Policy link opens in a new tab (`target="_blank"`, `rel="noopener noreferrer"`).

### 3. Footer links in new tab during checkout

Add `openLinksInNewTab?: boolean` to `LegalFooter`. `OrderShell` passes `openLinksInNewTab` for all buyer checkout pages. Other surfaces (landing, dashboard, legal pages) keep same-tab navigation.

Consent checkbox ToS/Privacy links unchanged (already new-tab).

## Out of scope

- Fetching retention days from API.
- Changing legal page “Back to home” behavior.
- Retention copy on other order steps.

## Testing

- Event/store entry: visible gap between “Start order” and footer line.
- Customer step: retention text above consent; Privacy link opens new tab.
- Footer Privacy/Terms during any `/order/*` page: new tab; original tab still on checkout.
- Edit submitted order: no retention notice or consent block.
