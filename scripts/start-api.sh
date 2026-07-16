#!/usr/bin/env sh
set -eu

cd /app

echo "[api] Running prisma migrate deploy..."
npx prisma migrate deploy

echo "[api] Starting Express on port ${API_PORT:-${PORT:-4000}}..."
exec npx tsx server/src/index.ts
