#!/usr/bin/env sh
set -eu

cd /app

DB_URL="${DATABASE_URL:-${DATABASE_PRIVATE_URL:-}}"

if [ -z "$DB_URL" ]; then
  echo "[web] ERROR: DATABASE_URL (or DATABASE_PRIVATE_URL) is not set (empty)."
  echo "[web] App Router routes such as GET /api/auth/me use Prisma on the web service."
  echo "[web] Add a Railway Postgres plugin, then set web DATABASE_URL to the Postgres variable reference"
  echo "[web] (e.g. \${{ Postgres.DATABASE_URL }}). Do not use the localhost URL from .env.example."
  exit 1
fi

case "$DB_URL" in
  *localhost*|*127.0.0.1*)
    echo "[web] ERROR: DATABASE_URL points to localhost/127.0.0.1 — that only works on your laptop."
    echo "[web] Symptom if ignored: ECONNREFUSED on prisma.user.findFirst / GET /api/auth/me,"
    echo "[web] and the UI shows \"Your account could not be loaded\"."
    echo "[web] In Railway: web Variables → DATABASE_URL → Variable Reference to Postgres."
    exit 1
    ;;
esac

echo "[web] DATABASE_URL is set (length ${#DB_URL}). Starting Next.js..."
exec node server.js
