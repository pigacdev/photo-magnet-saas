# Records of Processing Activities (RoPA)

Internal document — GDPR Art. 30. Last updated: 2026-07-14.

## Controller activities (Magnetoo → Seller data)

| Activity | Data categories | Purpose | Legal basis | Retention | Recipients |
|----------|----------------|---------|-------------|-----------|------------|
| Seller registration | Email, name, Clerk ID | Account creation | Contract | Account lifetime + erasure grace | Clerk |
| Billing | Stripe/Clerk customer IDs, plan | Subscriptions | Contract | Legal minimum for invoices | Clerk, Stripe |
| Support tickets | Email, message content | Customer support | Legitimate interest | 2 years | Resend |
| Platform analytics (seller KPIs) | Aggregated order counts/revenue | Service improvement | Legitimate interest | Indefinite (aggregates) | None |

## Processor activities (Magnetoo → Buyer data on Seller's behalf)

| Activity | Data categories | Purpose | Legal basis | Retention | Recipients |
|----------|----------------|---------|-------------|-----------|------------|
| Order checkout | Name, email, phone, address, photos | Order fulfilment | Contract (Seller–Buyer); processing on Seller instructions | See retention config | S3, Resend |
| Transactional email | Email, order summary | Order confirmation | Contract | N/A (transient) | Resend |
| Image processing | Photos, crop metadata | Print accuracy | Contract | Media retention env vars | S3 |
| Internal analytics | Order aggregates; transient phone/name for unique customer count | Seller event insights | Legitimate interest (Seller) | Order row lifetime | None |

## Security measures (Art. 32)

- TLS in transit
- Helmet, CORS, rate limiting on API
- HttpOnly/Secure session cookies
- RBAC (Admin/Staff roles)
- Signed upload URLs / scoped storage paths
- Webhook signature verification (Clerk, Stripe)
- Production error logs exclude request bodies
- Audit logging for erasure and DSAR actions

## Analytics note

Seller dashboard and event analytics are first-party, aggregate-only. No third-party analytics cookies. Event `uniqueCustomers` transiently reads `customerName`/`customerPhone` on order rows to produce a count; output is never individual identities.
