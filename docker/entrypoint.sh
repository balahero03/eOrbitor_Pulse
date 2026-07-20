#!/bin/sh
set -e

# One-off data fix for the UserRole enum rename (SALES_MANAGER/SALES_EXEC/
# SUPPORT/VIEWER -> BACKEND_TEAM/ON_FIELD_TEAM). `db push` cannot ALTER the
# enum type while rows still reference dropped variants, so remap them first.
# Safe to run every boot: the UPDATEs are no-ops once no rows match.
echo "[entrypoint] Remapping legacy UserRole values (if any)..."
node scripts/fix-user-role-enum.js || echo "[entrypoint] Role remap skipped (fresh DB or already clean)."

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
