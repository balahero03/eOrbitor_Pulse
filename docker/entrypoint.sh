#!/bin/sh
set -e

# Pre-push data/schema fixes `db push` can't handle alone against a live DB
# with existing data — see scripts/pre-push-fixes.js for details.
echo "[entrypoint] Running pre-push fixes..."
node scripts/pre-push-fixes.js || echo "[entrypoint] Pre-push fixes skipped (fresh DB or already applied)."

echo "[entrypoint] Syncing database schema..."
# This project ships an incomplete migration history (the base CREATE TABLEs
# were never captured as migrations), so we sync the schema directly from
# schema.prisma via db push — the same approach run.sh uses. Idempotent.
npx prisma db push --skip-generate --accept-data-loss

# Seed only if SEED=true is set (run once on first deploy)
if [ "$SEED" = "true" ]; then
  echo "[entrypoint] Seeding database..."
  npm run db:seed || echo "[entrypoint] Seed failed or already seeded, continuing."
fi

echo "[entrypoint] Starting app: $*"
exec "$@"
