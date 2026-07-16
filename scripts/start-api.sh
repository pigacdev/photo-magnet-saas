#!/usr/bin/env sh
set -eu

cd /app

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[api] ERROR: DATABASE_URL is not set (empty)."
  echo "[api] Add a Railway Postgres plugin, then set api DATABASE_URL to the Postgres variable reference"
  echo "[api] (e.g. \${{ Postgres.DATABASE_URL }}). Do not use the localhost URL from .env.example."
  exit 1
fi

case "$DATABASE_URL" in
  *localhost*|*127.0.0.1*)
    echo "[api] ERROR: DATABASE_URL points to localhost/127.0.0.1 — that only works on your laptop."
    echo "[api] In Railway: Variables → DATABASE_URL → use a reference to your Postgres service"
    echo "[api] (Add Plugin → PostgreSQL, then Variable Reference → DATABASE_URL)."
    exit 1
    ;;
esac

echo "[api] DATABASE_URL is set (length ${#DATABASE_URL}). Running prisma migrate deploy..."
npx prisma migrate deploy

echo "[api] Starting Express on port ${API_PORT:-${PORT:-4000}}..."
exec npx tsx server/src/index.ts
