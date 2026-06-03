# Tech Stack

This document describes the technologies used in **photo-magnet-saas** and how they fit together.

For product context and business goals, see [masterplan.md](./masterplan.md).

---

## Architecture (one sentence)

**Next.js** serves the UI; a **standalone Express API** handles business logic, uploads, PDF generation, Stripe webhooks, and cron jobs. Next.js rewrites `/api/*` and `/uploads/*` to the API server (default port **4000**).

```
Browser → Next.js (port 3000) → rewrites → Express API (port 4000) → PostgreSQL / S3
```

---

## Frontend

| Layer | Technology | Notes |
|-------|------------|-------|
| Framework | **Next.js 16** | App Router under `src/app/` |
| UI library | **React 19** | |
| Language | **TypeScript** | |
| Styling | **Tailwind CSS 4** | PostCSS |
| Theming | `next-themes` | Dark/light mode |
| Charts | `recharts` | Dashboard analytics |
| QR codes | `qrcode.react` | Storefront / event ordering links |

**Scripts:** `next dev`, `next build`, `next start`

**Proxy config:** `next.config.ts` rewrites `/api/:path*` and `/uploads/:path*` to `INTERNAL_API_URL` or `NEXT_PUBLIC_API_URL` (fallback `http://127.0.0.1:4000`).

---

## Backend (API server)

| Layer | Technology | Notes |
|-------|------------|-------|
| Runtime | **Node.js** | |
| HTTP server | **Express 5** | `server/src/` |
| Dev runner | **tsx** | `npm run dev:server` — watch mode |
| Security | `helmet`, `cors`, `express-rate-limit` | |
| Auth | **Clerk** | Seller sessions via Clerk; Express verifies Clerk tokens |
| File uploads | **multer** | Multipart handling |

**Entry point:** `server/src/index.ts`

**Local dev:** run Next.js and the API server together (`npm run dev` + `npm run dev:server`).

---

## Data & storage

| Layer | Technology | Notes |
|-------|------------|-------|
| Database | **PostgreSQL** | |
| ORM | **Prisma 7** | Schema: `prisma/schema.prisma`; client generated to `src/generated/prisma` |
| Object storage | **AWS S3** | `@aws-sdk/client-s3` — production media |
| Local uploads | `uploads/` | Dev / fallback; served by Express at `/uploads` |

**DB scripts:** `db:generate`, `db:migrate`, `db:push`, `db:studio`

See [database-schema.md](./database-schema.md) for the data model.

---

## Integrations & processing

| Concern | Technology | Notes |
|---------|------------|-------|
| Payments | **Stripe** | Subscriptions, checkout, webhooks |
| Email | **Resend** | Transactional mail |
| Image processing | **Sharp** | Resize, crop pipeline for print accuracy |
| Print sheets | **pdf-lib** | PDF generation for ready-to-print output |
| Scheduled jobs | **node-cron** | e.g. expired media cleanup |
| Exports | **archiver** | ZIP exports (e.g. event media) |

Image and print behavior are specified in [image-processing-and-printing.md](./image-processing-and-printing.md).

---

## Tooling

| Tool | Purpose |
|------|---------|
| **ESLint** | Linting (`eslint-config-next`) |
| **Prisma CLI** | Migrations, generate, Studio |
| **TypeScript** | Type checking across app and server |

---

## Version reference (from `package.json`)

Key pinned versions at time of writing:

- `next`: 16.2.0
- `react` / `react-dom`: 19.2.4
- `express`: 5.x
- `@prisma/client` / `prisma`: 7.x
- `tailwindcss`: 4.x

Check `package.json` for the authoritative list.
