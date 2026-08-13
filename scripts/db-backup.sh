#!/bin/bash
# eOrbitor Pulse - PostgreSQL + uploads backup
# Dumps the database from the running Docker container to a timestamped,
# gzipped file, archives the uploaded files, and prunes both older than
# RETENTION_DAYS.
#
# The uploads archive is NOT optional. Payment receipts and lead attachments
# are stored on disk under FILE_UPLOAD_DIR with only their metadata in
# Postgres, so a database-only restore comes back with every row intact and
# every file missing — and the loss is silent until someone opens a receipt.
set -euo pipefail

# --- config ---
BACKUP_DIR="${BACKUP_DIR:-$HOME/eorbitor-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DB_CONTAINER="eorbitor-db"
DB_USER="eorbitor"
DB_NAME="eorbitor_pulse"
# Must match FILE_UPLOAD_DIR in .env.local (lib/storage.ts falls back to
# <app>/uploads when the configured path is not writable).
UPLOAD_DIR="${FILE_UPLOAD_DIR:-/opt/eorbitor-pulse/uploads}"
# --------------

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y-%m-%d_%H-%M-%S)"
OUT="$BACKUP_DIR/eorbitor_pulse_$TS.sql.gz"

echo "[backup] Dumping $DB_NAME from container $DB_CONTAINER ..."
# pg_dump runs inside the container (no host psql needed). -Fc would be custom
# format; we use plain SQL gzipped so it's portable and inspectable.
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists \
  | gzip > "$OUT"

SIZE="$(du -h "$OUT" | cut -f1)"
echo "[backup] Wrote $OUT ($SIZE)"

# --- uploaded files (payment receipts, lead attachments) ---
FILES_OUT="$BACKUP_DIR/eorbitor_uploads_$TS.tar.gz"
if [ -d "$UPLOAD_DIR" ]; then
  echo "[backup] Archiving uploads from $UPLOAD_DIR ..."
  tar -czf "$FILES_OUT" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
  echo "[backup] Wrote $FILES_OUT ($(du -h "$FILES_OUT" | cut -f1))"
else
  # Loud, because a silent skip here is exactly how receipts go missing.
  echo "[backup] WARNING: upload dir '$UPLOAD_DIR' not found — no files archived."
  echo "[backup]          Set FILE_UPLOAD_DIR to the path the app actually writes to."
fi

echo "[backup] Pruning backups older than $RETENTION_DAYS days ..."
find "$BACKUP_DIR" -name 'eorbitor_pulse_*.sql.gz' -mtime +"$RETENTION_DAYS" -print -delete || true
find "$BACKUP_DIR" -name 'eorbitor_uploads_*.tar.gz' -mtime +"$RETENTION_DAYS" -print -delete || true

echo "[backup] Done. Current backups:"
ls -lh "$BACKUP_DIR"/eorbitor_pulse_*.sql.gz 2>/dev/null | tail -5
ls -lh "$BACKUP_DIR"/eorbitor_uploads_*.tar.gz 2>/dev/null | tail -5
