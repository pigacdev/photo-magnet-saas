# Subprocessor list

Published at `/subprocessors`. Keep in sync with the public page.

| Provider | Purpose | Data | Location |
|----------|---------|------|----------|
| Clerk | Seller auth, billing UI | Email, name, sessions | US/EU |
| Stripe | Legacy subscriptions | Billing IDs | US/EU |
| Railway | App hosting + managed Postgres | App data, logs | Configurable (prefer EU) |
| Cloudflare R2 / AWS S3 | File storage | Photos, PDFs | Configurable (prefer EU) |
| Resend | Email | Addresses, content | US |
| Sentry | Error monitoring | Stack traces, request metadata (no intentional PII) | US/EU |
| UptimeRobot | Availability checks | Public URL reachability | US |

Material changes: notify sellers via email or dashboard notice.
