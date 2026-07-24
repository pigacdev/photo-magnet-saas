# Magnetoo Studio Landing-Page AI Context

**Product snapshot:** July 24, 2026  
**Purpose:** Source-of-truth context for prompting AI models to plan, write, design, or implement the Magnetoo Studio landing page.

## How to use this document

Give this document to the AI model before asking for landing-page work. Tell it which output you need, such as:

- positioning options;
- a page outline;
- landing-page copy;
- a visual direction;
- responsive UI implementation;
- SEO metadata;
- or a copy/design critique.

The model must treat the **Verified product truth** and **Claim guardrails** sections as hard constraints. It must not turn roadmap ideas, internal targets, or unresolved technical work into public claims.

## Authority order

When sources disagree, use this order:

1. Current application behavior and enforced feature gates.
2. `docs/technical-dept.md`, especially launch blockers and production-validation notes.
3. `src/lib/planCatalog.ts` for enforced limits and app features, then `billing.json` for current Clerk prices.
4. `src/lib/billingPlanDisplay.ts` for presentation copy only. If it conflicts with enforced gates, the gates win.
5. Product and design documentation.
6. `docs/masterplan.md` only for vision, audience, and problem framing—not as proof that a feature exists.

## Product identity

### Approved public brand

**Magnetoo Studio**

Use this exact name in landing-page work unless a later brand decision replaces it.

The repository currently contains inconsistent names:

- “Magnetoo” in app metadata and legal content;
- “Magnetoo Studio” in print branding and selected legal copy;
- “Photo Magnet” on the current home page.

Do not reproduce this inconsistency in new marketing output. A future implementation should align app metadata and legal naming separately; this brief does not authorize those changes.

### Product category

Magnetoo Studio is workflow software for businesses that sell photo magnets at events or through a permanent ordering link.

It combines:

- QR/link-based customer ordering;
- guided photo upload and cropping;
- seller order management;
- and print-ready PDF generation for supported magnet formats.

### One-sentence description

Magnetoo Studio helps photo-magnet sellers collect customer orders and turn submitted photos into print-ready sheets from one calm, guided workflow.

### Elevator pitch

Photo-magnet sellers often collect orders, photos, crop instructions, customer details, and print files through disconnected manual steps. Magnetoo Studio gives customers a simple mobile ordering flow and gives sellers one place to manage each order, prepare print sheets, and track fulfillment.

### Mission

Move a customer photo from order to print with less confusion and fewer avoidable production mistakes.

## Target market

### Primary audiences

1. **Event photo-magnet vendors**  
   Sellers working at weddings, parties, celebrations, fairs, and other time-limited events.

2. **Event photographers and photo-booth operators**  
   Businesses that want to add or streamline on-site magnet sales.

3. **Side-hustle and growing magnet businesses**  
   Sellers who need a repeatable workflow without building custom ordering software.

### Secondary audience

- Small print shops offering photo magnets at events or through a shared online link.

### Buyer roles

- **Business owner:** chooses the software, plan, branding, pricing, and workflows.
- **Seller/operator:** monitors incoming orders, prepares print files, and updates order status.
- **End customer:** scans a QR code or opens a link, uploads and crops photos, and submits an order without creating an account.

Staff-account management is not currently a marketable feature. Do not imply that teams can be invited or administered.

## Core customer problems

### Seller problems

- Orders arrive through conversations, notes, folders, or unrelated tools.
- Photos can become detached from the correct customer or order.
- Crop expectations can be unclear until a print is produced.
- Repetitive file preparation slows production.
- Sellers need to find new, unpaid, or unprinted orders quickly.
- Event and ongoing storefront orders need a consistent operating workflow.

### End-customer problems

- Sending photos and order details manually is slow and ambiguous.
- Customers may not know how their photo will fit the magnet.
- Complicated or branching checkout flows create friction on a phone.
- Customers need a clear order reference and next step after submission.

## Jobs to be done

### Seller job

“When I am selling photo magnets, help me collect complete customer orders and prepare accurate print files in one workflow so I can focus on producing and fulfilling orders.”

### Event job

“When I start an event, help me publish a time-limited ordering experience quickly and stop new orders when the event closes.”

### Storefront job

“When customers order outside an event, give me a permanent link I can share and a way to manage pickup or delivery details.”

### End-customer job

“When I want photo magnets, let me choose, upload, position, and submit my photos from my phone without needing instructions from the seller.”

## Positioning

### Positioning statement

For independent photo-magnet sellers who need a dependable order-to-print workflow, Magnetoo Studio is a specialized SaaS platform that connects mobile customer ordering with seller operations and print preparation. Unlike generic forms, chat threads, or file-sharing tools, it keeps order details, crop decisions, images, pricing, and print status connected.

### Primary value proposition

**From customer order to print-ready sheet in one guided workflow.**

### Supporting value propositions

1. **Make ordering easy to start**  
   Share an event or storefront through a QR code or link.

2. **Keep each photo connected to its order**  
   Customer details, selected quantity, crop data, and images stay together.

3. **Reduce crop-to-print uncertainty**  
   The crop interaction uses a fixed shape frame and stored crop data that the server uses to render the final image.

4. **Move from order to production without rebuilding files manually**  
   Preview and generate print-ready PDF sheets from an order.

5. **See what needs attention**  
   Search and filter orders by operational and print status.

### Differentiation

The strongest differentiator is not “online ordering” by itself. It is the connection between:

1. the customer’s crop decision;
2. the committed order image;
3. server-side final rendering;
4. the print-ready PDF;
5. and printed-status tracking.

Marketing should present Magnetoo Studio as specialist workflow software for photo-magnet production, not as a generic e-commerce platform or general photo editor.

## Verified product truth

The capabilities below are implemented and may be described accurately, subject to plan limits and the production-format restriction.

### Customer ordering

- Customers enter through a seller’s event or storefront link.
- Sellers can share customer links as QR codes.
- The seller must complete required shop setup, including currency, before accepting orders.
- Customers do not need a seller-dashboard account to order.
- The mobile flow guides customers through product selection, quantity or bundle selection, photo upload, crop, review, customer details, and submission.
- Pricing can be configured as either per-item pricing or bundles for a given event/storefront. The two modes are not mixed in one context.
- The displayed total updates from the selected pricing option.
- Storefront orders can support seller-configured pickup or delivery.
- A submitted customer receives an order reference.
- Buyer confirmation email is available when an email address is provided.
- Payment is arranged with or recorded by the seller; there is no buyer-facing online card checkout.

### Events

- Sellers can create and manage time-bounded events.
- An event has a customer link and QR code.
- Sellers can configure event pricing and the shape options currently offered by the product.
- An event accepts orders only while active and within its configured start/end window.
- Event configuration supports a banner, seller notification email, and order limits.
- After an event ends, sellers can export images from paid/settled orders as a ZIP while the configured post-event retention window remains open.

### Storefront

- Each organization can have one storefront.
- The storefront provides a persistent customer link and QR code.
- Sellers can configure pricing, pickup details, and order settings.
- Hobby and Pro support storefront vacation mode.
- Storefront orders currently use pickup or delivery options where configured.

### Order operations

- Sellers have an orders dashboard with pagination, search, and filters.
- Filters include order/operational status, context, and print status.
- Order details keep customer information and committed order images together.
- Sellers can update supported order statuses, edit customer details on an order, cancel orders, and remove images.
- Hobby and Pro can send supported customer emails from the order workflow.
- New-order awareness uses periodic polling. Call it “new-order notifications” or “new-order alerts,” not instantaneous real-time streaming.

### Print workflow

- Sellers can preview a PDF from any non-cancelled order without changing print state.
- Once an order is marked paid or reaches a later print-eligible status, sellers can select images and generate the production PDF.
- The selected production-print action can mark those images as printed.
- Sellers can track whether an order needs printing or is fully printed.
- Print operations are currently handled from each order, not from a global cross-order print queue.

### Analytics and business tools

- Free includes basic dashboard analytics.
- Hobby and Pro include advanced dashboard analytics, event analytics, and an event calendar.
- Pro includes customer management and orders CSV export.
- Hobby and Pro include support; Pro support is prioritized.

### Privacy-oriented product behavior

The product includes public privacy, terms, cookies, subprocessors, imprint, and early-access terms pages. It also includes buyer consent, seller data controls, retention workflows, account-level export, and account-erasure workflows. Pro adds customer-management export tools.

Safe wording:

- “Built with privacy-conscious order and media workflows.”
- “Includes data export and deletion controls.”

Unsafe wording:

- “Fully GDPR compliant.”
- “Legally certified.”
- “Enterprise-grade security.”

Those claims require legal or security substantiation beyond the presence of product controls.

## The crop-to-print principle

### Product promise

The intended system rule is:

> What the customer sees in the crop should determine what is rendered for print.

The customer moves and zooms the image inside a fixed shape frame. The application stores crop data and uses server-side processing to create the final rendered image. The PDF workflow uses the rendered output rather than visually cropping only in the browser.

### Shape availability and public wording

Shape availability is controlled by production validation and the live product configuration. AI-generated public copy should not enumerate catalog or roadmap formats.

Describe the experience from the customer’s perspective:

> Choose from the shapes offered by the seller.

When generating screenshots or UI mockups, show only options that are available in the live product.

### Safe print wording

“Generate print-ready PDF sheets for the shapes you offer.”

### Wording to avoid

- “Supports every magnet shape.”
- “Four production-ready sizes.”
- “Guaranteed perfect prints.”
- “Zero printing mistakes.”
- “Color-accurate on every printer.”
- “Full 300 DPI quality enforcement on every upload.”

The product aims for print accuracy, but guarantees and universal printer claims are not substantiated.

## Plans and pricing snapshot

Subscription billing is in USD. Seller-defined magnet prices can use the seller’s configured currency and are separate from the SaaS subscription currency.

Pricing can change. Before publishing generated copy, re-check `billing.json` and the live billing configuration.

### Free — $0

Designed for trying the workflow at a first event.

- Up to 10 orders per billing period.
- Up to 1 event per billing period.
- 1 storefront.
- QR ordering.
- Print-ready PDFs for the validated production format.
- Basic analytics.
- Magnetoo Studio branding on print PDFs.
- Automatic buyer confirmations and seller new-order alerts use platform branding; custom email branding and manual customer emails require Hobby or Pro.

### Hobby — $12/month or $9/month equivalent with annual billing

Designed for side hustlers and regular event sellers.

- Everything in Free.
- Up to 50 orders per billing period.
- Up to 5 events per billing period.
- Advanced and event analytics.
- Event calendar.
- Custom print branding.
- Professional branded email notifications.
- Supported manual customer emails.
- Customer support.
- Storefront vacation mode.

### Pro — $34/month or $29/month equivalent with annual billing

Designed for professional vendors and growing businesses.

- Everything in Hobby.
- Unlimited orders per billing period.
- Unlimited events per billing period.
- Customer management.
- Orders CSV export.
- Priority support.

### Early-access offer

The application contains a conditional early-access program for the first 20 eligible sellers:

- 60-day trial on Hobby or Pro;
- card required;
- availability depends on remaining seats and live billing configuration.

Do not hard-code the offer into evergreen landing-page copy without reading its live state. Do not promise the optional lifetime loyalty discount: its automated transition still has unresolved production-verification items.

## Messaging pillars

### 1. One order-to-print workflow

Lead with the connected process, not a long feature inventory.

Proof:

- QR/link entry;
- guided customer order;
- order-linked images and crop data;
- seller order dashboard;
- PDF generation and print tracking.

### 2. Easy for customers at the moment of purchase

Emphasize phone-friendly ordering and a clear sequence.

Safe message:

“Customers scan, choose, upload, crop, and submit.”

Do not add “pay online” to this sequence.

### 3. Built around photo-magnet production

Explain that the crop is not a decorative preview: crop data continues into server-side rendering and print preparation.

### 4. Calm control for sellers

Emphasize finding orders, seeing status, and moving work toward print without switching between unrelated tools.

### 5. Start small and grow

Free supports initial use; Hobby and Pro add capacity and operational tools. Keep plan claims exact.

## Voice and tone

### Personality

- Calm.
- Clear.
- Precise.
- Quietly confident.
- Slightly friendly.
- Operationally credible.

### Writing rules

- Use short sentences and concrete verbs.
- Explain outcomes before implementation details.
- Prefer “scan,” “upload,” “crop,” “review,” “print,” and “track.”
- Use “customer” for the seller’s buyer and “seller” or “vendor” for the SaaS user.
- Keep one idea per paragraph.
- Avoid technical language such as normalized coordinates, polymorphic contexts, webhooks, and server routes in customer-facing copy.
- Avoid hype, fear, and unprovable superlatives.
- Do not call the product an AI platform; AI-assisted cropping is only a future idea.

### Preferred phrases

- “From order to print-ready.”
- “One guided workflow.”
- “Built for photo-magnet sellers.”
- “Share a QR code or link.”
- “Keep orders, photos, and print status together.”
- “See what needs printing.”

### Avoid

- “Revolutionary.”
- “10× faster.”
- “Error-free.”
- “Pixel-perfect on every printer.”
- “Real-time” when describing polling-based notifications.
- “Complete e-commerce platform.”
- “Automated payments.”
- “All-in-one” unless the sentence names the included workflow boundaries.

## Visual direction

### Emotional target

A calm, high-end print studio: precise, uncluttered, and trustworthy.

### Design principles

- Make the primary action obvious.
- Use generous spacing and a restrained visual hierarchy.
- Demonstrate the workflow visually instead of relying on abstract feature icons.
- Use real product UI or accurate product mockups; show only shape options surfaced in the live product and omit buyer card checkout.
- Show customer mobile ordering alongside the seller dashboard to explain the two-sided workflow.
- Treat the crop-to-print transition as the key product demonstration.

### Existing visual system

- Primary text: near black (`#111111`).
- Secondary text: soft gray (`#6B7280`).
- Backgrounds: white (`#FFFFFF`) and light gray (`#F9FAFB`).
- Action accent: blue (`#2563EB`).
- Success: green (`#16A34A`).
- Warning: orange (`#F59E0B`).
- Error: red (`#DC2626`).
- Typeface: Inter.
- Spacing: 8-point system.
- Motion: subtle, generally 150–200 ms.

### Accessibility

- Maintain at least 4.5:1 text contrast.
- Keep focus states visible.
- Make mobile targets at least 44 px high.
- Do not communicate status by color alone.
- Respect reduced-motion preferences.
- Add meaningful alt text to product visuals.

## Recommended landing-page narrative

This is a messaging structure, not final copy.

### 1. Header

- Magnetoo Studio brand.
- Links to workflow/features, pricing, and FAQ.
- Secondary action: “Log in.”
- Primary action: “Create free account” or “Start free.”

Do not use “Start free trial” as the universal CTA because Free has no trial and early-access availability is conditional.

### 2. Hero

Answer three questions immediately:

1. Who is it for? Photo-magnet sellers.
2. What does it do? Connects customer ordering to print preparation.
3. What should the visitor do? Create a free account.

Suggested proof direction: mobile order flow next to an order/print dashboard, showing a shape offered by the seller.

### 3. Problem-to-outcome section

Contrast scattered chats, photos, and manual print preparation with one connected order-to-print workflow. Do not shame sellers or exaggerate time savings.

### 4. Three-step workflow

1. Share an event or storefront QR/link.
2. Customer chooses, uploads, crops, and submits.
3. Seller records payment, generates the print PDF, and tracks status.

Payment must not appear as a buyer online-checkout step.

### 5. Crop-to-print trust section

Show how the customer crop decision continues into server-rendered output and the corresponding print sheet.

### 6. Event and storefront use cases

- Event: a time-bounded customer link for on-site selling; the customer flow does not offer storefront pickup/delivery selection.
- Storefront: a persistent link with configured pickup or delivery.

Avoid describing event credits; current subscriptions use per-billing-period event limits.

### 7. Operations section

Show order search/filtering, statuses, per-order printing, analytics, and plan-gated tools. Do not show a global images library or cross-order print queue.

### 8. Pricing

Present Free, Hobby, and Pro with exact current prices and entitlements. Label annual prices accurately. Display early-access messaging only when availability is confirmed dynamically.

### 9. FAQ

Recommended questions:

- Do customers need an account?
- How do customers place an order?
- Can customers pay online?
- How do customers choose a magnet shape?
- Can I use Magnetoo Studio for events and ongoing orders?
- What happens when I reach my plan limit?
- Can I use my branding?
- What currencies can I use for my magnet prices?

### 10. Final CTA and legal footer

Repeat the free-account CTA. Include links to the existing legal pages.

## CTA guidance

### Primary CTA

**Create free account**

This is accurate for all visitors and does not depend on early-access availability.

### Secondary CTAs

- “See how it works.”
- “View pricing.”
- “Log in.”

### Conditional early-access CTA

If and only if the live early-access state confirms remaining seats:

- “Start 60-day Hobby trial.”
- “Start 60-day Pro trial.”

Mention that a card is required wherever the trial CTA appears.

## Claim guardrails

### Do not claim these capabilities

- Buyer-facing Stripe, card, Apple Pay, or Google Pay checkout.
- Google Drive photo upload.
- Multiple production-ready shapes or sizes.
- A global image library or cross-order print queue.
- BoxNow checkout integration.
- Staff invitations, seats, or team management.
- AI crop suggestions or face detection.
- Offline ordering or offline synchronization.
- Conversion-rate analytics.
- White-label functionality.
- Guaranteed real-time notifications.
- Event-credit licensing.
- Printing an unpaid order as though it were production-ready.
- Unqualified event ZIP export claims; export is post-event, paid/settled-orders-only, and time-limited.

### Do not make these trust claims

- Guaranteed perfect printing.
- Zero errors or zero mistakes.
- Fully GDPR compliant.
- Enterprise-grade security.
- Certified security or compliance.
- A specific uptime or availability percentage.
- A specific speed, revenue, conversion, or productivity improvement.
- Customer counts, order counts, ratings, or market leadership.

### Do not invent social proof

No verified testimonials, customer logos, case studies, ratings, usage totals, or performance studies are available in the repository. Use a clearly labeled placeholder only when the user explicitly asks for a wireframe placeholder. Never present invented proof as real.

### Known launch-sensitive facts

- Public shape copy should say “offered shapes” rather than enumerate the full catalog or roadmap.
- Buyer online payments are not implemented.
- Early-access loyalty-price transition has unresolved verification work.
- The legal business address remains a pre-launch placeholder in the repository.
- Clerk legal acceptance must be configured before production.
- Storefront media retention policy is not yet complete.
- Billing automation depends on production configuration.
- A seller must configure shop currency before customer ordering can open.

These facts are context for accurate output. Most should not be featured as marketing copy, but generated work must not contradict them.

## Objection handling

### “Will this replace my payment system?”

No. Magnetoo Studio currently organizes ordering, customer details, production, and seller-side payment status. Customers arrange payment with the seller rather than completing an online card checkout in the customer flow.

### “How do customers choose a magnet shape?”

Customers choose from the shape options the seller has configured and Magnetoo Studio currently offers.

### “Is this only for live events?”

No. Sellers can use time-limited events and one persistent storefront from the same account.

### “Will customers need to install an app?”

No install is required. Customers open the seller’s link or QR destination in their browser.

### “Can I use my own branding?”

Hobby and Pro support custom print branding. Free print PDFs use Magnetoo Studio branding.

## SEO and discovery context

Use search language that matches the actual niche and capabilities:

- photo magnet software;
- photo magnet ordering system;
- QR ordering for photo magnets;
- event photo magnet software;
- photo magnet seller dashboard;
- photo magnet order management;
- print-ready photo magnet PDF;
- photo booth magnet ordering;
- wedding photo magnet ordering.

Avoid targeting keywords that imply unsupported capabilities, such as “photo magnet online payment platform,” “AI magnet designer,” or “all-shape magnet printing software.”

Search intent should remain seller-focused. The landing page markets SaaS to vendors, not individual customers looking to buy one magnet.

## Evidence the landing page should eventually show

Prefer verifiable product evidence:

- a real event/storefront QR entry screen;
- the mobile upload and crop flow;
- the review step;
- an orders dashboard with safe demo data;
- a per-order PDF preview;
- a print sheet for an offered shape;
- plan-gated analytics or calendar screens;
- a short screen recording of the order-to-print sequence.

Before publishing screenshots:

- use fictional customer names and contact details;
- remove real order IDs and event data;
- show only currently available features;
- keep the UI consistent with Magnetoo Studio naming;
- and avoid implying that demo data is customer proof.

## Information that must come from the owner

AI models must ask for or omit the following rather than inventing it:

- verified testimonials or case studies;
- approved customer or partner logos;
- registered legal business name and address;
- final support and sales contact details;
- approved domain and social profiles;
- actual customer counts or order volume;
- measured time savings or error reduction;
- launch geography and language support;
- refund or service-level promises;
- a live early-access seat count;
- final screenshots and product video.

## Reusable master prompt

Copy this prompt and append the specific task:

```text
You are working on the public landing page for Magnetoo Studio, a SaaS workflow for photo-magnet sellers.

Use the attached “Magnetoo Studio Landing-Page AI Context” as the source of truth. Follow its authority order and claim guardrails. Describe only currently implemented, marketable capabilities. Do not turn roadmap ideas, internal goals, technical intentions, or unresolved launch work into public claims.

Key constraints:
- The audience is photo-magnet sellers, event photographers, photo-booth operators, and small print shops—not consumers buying a single magnet.
- The core story is one guided workflow from customer QR/link order to seller print preparation.
- Customers upload, crop, review, and submit; they do not complete online card payment.
- Describe shape selection as choosing from seller-offered shapes; do not enumerate the full catalog or roadmap.
- Printing is managed per order; there is no global cross-order print queue.
- Use “Magnetoo Studio” as the public brand.
- Keep plan prices, limits, and feature gates exact.
- Do not invent testimonials, metrics, certifications, integrations, or guarantees.
- Use a calm, clear, precise, quietly confident voice.
- Clearly label any assumptions or placeholders.

Task:
[INSERT THE SPECIFIC REQUEST]

Output requirements:
[INSERT FORMAT, LENGTH, AUDIENCE, DEVICE, FRAMEWORK, OR SEO REQUIREMENTS]
```

## Useful prompt examples

### Page strategy

```text
Using the attached context, create three landing-page positioning approaches. For each, provide the target visitor, central promise, proof sequence, risks, and recommended CTA. Recommend one approach. Do not write final copy yet.
```

### Landing-page copy

```text
Using the attached context, write concise desktop and mobile landing-page copy following the recommended narrative. Include hero, workflow, trust, event/storefront, operations, pricing-intro, FAQ, and final CTA sections. Do not invent social proof. Add a factual-basis note after each section for internal review.
```

### UI implementation

```text
Using the attached context and the repository’s existing design system, implement the responsive landing page. Reuse existing components and tokens where appropriate. Show only shape options available in the live product, but describe them publicly as seller-offered shapes. Preserve accessibility, legal links, sign-in, and sign-up routes. Do not modify product logic.
```

### Copy review

```text
Audit the supplied landing-page copy against the attached context. List every unsupported, ambiguous, outdated, or plan-inaccurate claim. For each issue, quote the claim, explain the conflict, and provide a safer replacement.
```

## AI output checklist

Before accepting generated work, confirm:

- [ ] The brand is Magnetoo Studio.
- [ ] The audience is the seller, not the seller’s customer.
- [ ] The main story connects ordering to print preparation.
- [ ] Buyer online payment is not implied.
- [ ] Shape copy refers to seller-offered options without enumerating unavailable formats.
- [ ] Printing is described as per-order, not a global queue.
- [ ] Event and storefront behavior are distinct and accurate.
- [ ] Plan prices, limits, and gated features match current sources.
- [ ] Early-access messaging is conditional and does not promise loyalty pricing.
- [ ] No testimonials, metrics, integrations, guarantees, or compliance claims were invented.
- [ ] Voice and visuals are calm, clear, precise, and accessible.
- [ ] Unknown business facts are requested, omitted, or clearly labeled.

## Source references

Primary product and messaging sources:

- `docs/masterplan.md`
- `docs/design-guidelines.md`
- `docs/app-flow-pages-and-roles.md`
- `docs/image-processing-and-printing.md`
- `docs/implementation-plan.md`
- `docs/technical-dept.md`
- `billing.json`
- `src/lib/planCatalog.ts`
- `src/lib/billingPlanDisplay.ts`
- `src/lib/shapePresets.ts`
- `src/app/page.tsx`

This document summarizes the product for marketing prompts. It does not replace the technical source files when implementing or changing application behavior.
