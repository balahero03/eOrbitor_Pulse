#!/bin/bash
# eOrbitor Pulse - PostgreSQL restore
# Restores a gzipped SQL backup into the running Docker DB container.
# Usage: ./db-restore.sh /path/to/eorbitor_pulse_YYYY-MM-DD_HH-MM-SS.sql.gz
set -euo pipefail

DB_CONTAINER="eorbitor-db"
DB_USER="eorbitor"
DB_NAME="eorbitor_pulse"

FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Usage: $0 <backup-file.sql.gz>"
  echo "Available backups:"
  ls -lh "$HOME/eorbitor-backups"/eorbitor_pulse_*.sql.gz 2>/dev/null || echo "  (none found)"
  exit 1
fi

echo "WARNING: this will OVERWRITE the current '$DB_NAME' database with:"
echo "  $FILE"
read -r -p "Type 'yes' to continue: " CONFIRM
[ "$CONFIRM" = "yes" ] || { echo "Aborted."; exit 1; }

echo "[restore] Restoring ..."
# The dump was made with --clean --if-exists, so it drops+recreates objects.
gunzip -c "$FILE" | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"

echo "[restore] Done. Restarting app to pick up clean state ..."
cd "$(dirname "$0")/.." && docker compose restart app
echo "[restore] Complete."
