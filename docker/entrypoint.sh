#!/bin/sh
set -e

echo "[entrypoint] Waiting for database..."
# Apply Prisma migrations (creates/updates tables). Safe to run every start.
npx prisma migrate deploy

# Seed only if SEED=true is set (run once on first deploy)
if [ "$SEED" = "true" ]; then
  echo "[entrypoint] Seeding database..."
  npm run db:seed || echo "[entrypoint] Seed failed or already seeded, continuing."
fi

echo "[entrypoint] Starting app: $*"
exec "$@"
