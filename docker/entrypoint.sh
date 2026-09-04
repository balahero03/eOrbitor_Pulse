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

# Mail preflight. Deliberately non-fatal — the `if` swallows the non-zero
# exit so `set -e` cannot kill the container over a mail outage — but loud,
# because the alternative is what we
# had: mail failing silently in production with no way to tell a missing
# SMTP_HOST from a blocked outbound port without shell access and a hand-rolled
# script. `docker logs eorbitor-app` now answers that at every boot.
#
# `.env.local` is not copied into the image; compose injects it as real
# environment via `env_file`, which is what scripts/test-mail.js reads when it
# finds no file on disk.
echo "[entrypoint] Checking mail configuration..."
if node scripts/test-mail.js; then
  echo "[entrypoint] Mail OK."
else
  echo "[entrypoint] ================================================================"
  echo "[entrypoint]  MAIL IS NOT WORKING - see the diagnosis above."
  echo "[entrypoint]  Password reset and account-recovery verification will fail."
  echo "[entrypoint]  The app will still start; fix SMTP_* in .env.local on this"
  echo "[entrypoint]  host and re-run: docker compose up -d app"
  echo "[entrypoint] ================================================================"
fi

echo "[entrypoint] Starting app: $*"
exec "$@"
