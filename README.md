# Photo Magnet SaaS

Full-stack photo magnet platform.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Backend:** Node.js + Express (TypeScript)
- **Database:** PostgreSQL with Prisma ORM
- **Storage:** S3-compatible (prepared)
- **Payments:** Stripe (prepared)

## Project Structure

```
/app            → Next.js pages (App Router)
/src/lib        → Shared frontend utilities
/server/src     → Express API server
  /routes       → API route handlers
  /middleware   → Express middleware
  /config       → Service configurations (S3, Stripe)
  /lib          → Server utilities (Prisma client)
/prisma         → Database schema & migrations
/docs           → Product specifications
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- npm

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your database credentials

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate
```

### Development

```bash
# Start Next.js frontend (port 3000)
npm run dev

# Start API server (port 4000) — in a separate terminal
npm run dev:server
```

### Database Commands

```bash
npm run db:generate   # Regenerate Prisma client
npm run db:migrate    # Create & apply migrations
npm run db:push       # Push schema without migration files
npm run db:studio     # Open Prisma Studio GUI
```

## Environment Variables

See `.env.example` for all required variables.
